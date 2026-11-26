import { randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import { io, type Socket } from "socket.io-client";
import WebSocket, { type RawData } from "ws";
import type { HeaderPair } from "../../src/types/engine/engine.type.ts";
import type {
  RealtimeConnectParams,
  RealtimeEvent,
  RealtimeEventKind,
  RealtimeSendParams,
} from "../../src/types/engine/realtime-engine.type.ts";
import {
  realtimeConnectSchema,
  realtimeSendSchema,
  runIdParamSchema,
} from "../../src/validators/engine.schema.ts";
import { EngineError, parseInput, toEngineError } from "./engine-error.ts";

const REALTIME_EVENT_CHANNEL = "aurolis:engine:realtime-event";

const MAX_LOGGED_BYTES = 1024 * 1024;

interface Connection {
  owner: WebContents;
  send: (params: RealtimeSendParams) => void;
  close: () => void;
}

const connections = new Map<string, Connection>();
const watchedOwners = new WeakSet<WebContents>();

function emit(
  owner: WebContents,
  connectionId: string,
  kind: RealtimeEventKind,
  data: string,
  event: string | null = null,
) {
  if (owner.isDestroyed()) return;
  const payload: RealtimeEvent = {
    connectionId,
    id: randomUUID(),
    kind,
    at: Date.now(),
    event,
    data,
  };
  owner.send(REALTIME_EVENT_CHANNEL, payload);
}

function headerObject(headers: HeaderPair[]) {
  const result: Record<string, string> = {};
  for (const [name, value] of headers) {
    const key = name.toLowerCase();
    result[key] = key in result ? `${result[key]}, ${value}` : value;
  }
  return result;
}

function toWebsocketUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol === "http:") parsed.protocol = "ws:";
  if (parsed.protocol === "https:") parsed.protocol = "wss:";
  return parsed.toString();
}

function toSocketioUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol === "ws:") parsed.protocol = "http:";
  if (parsed.protocol === "wss:") parsed.protocol = "https:";
  return parsed.toString();
}

function rawToText(data: RawData, isBinary: boolean) {
  const buffer = Array.isArray(data)
    ? Buffer.concat(data)
    : Buffer.from(data as ArrayBuffer);
  if (isBinary) return `[binary message, ${buffer.byteLength} bytes]`;
  return clip(buffer.toString("utf8"));
}

function clip(text: string) {
  if (text.length <= MAX_LOGGED_BYTES) return text;
  return `${text.slice(0, MAX_LOGGED_BYTES)}\n… (truncated)`;
}

function stringifyArgs(args: unknown[]) {
  const value = args.length === 1 ? args[0] : args;
  if (typeof value === "string") return clip(value);
  try {
    return clip(JSON.stringify(value, null, 2) ?? "undefined");
  } catch {
    return String(value);
  }
}

function parseJsonMessage(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    throw new EngineError(
      "invalid_input",
      `The message isn't valid JSON. ${detail}`.trim(),
    );
  }
}

function forget(connectionId: string, connection: Connection) {
  if (connections.get(connectionId) === connection) {
    connections.delete(connectionId);
  }
}

function watchOwner(owner: WebContents) {
  if (watchedOwners.has(owner)) return;
  watchedOwners.add(owner);
  owner.once("destroyed", () => {
    for (const [id, connection] of connections) {
      if (connection.owner !== owner) continue;
      connection.close();
      connections.delete(id);
    }
  });
}

function unexpectedResponseMessage(status: number | undefined) {
  return `The server answered HTTP ${status ?? "?"} instead of upgrading to a WebSocket.`;
}

function openWebsocket(
  params: RealtimeConnectParams,
  owner: WebContents,
): Promise<void> {
  const { connectionId } = params;
  const socket = new WebSocket(toWebsocketUrl(params.url), {
    headers: headerObject(params.headers),
    handshakeTimeout: params.timeoutMs,
  });
  const connection: Connection = {
    owner,
    send: ({ body, format }) => {
      if (format === "json") parseJsonMessage(body);
      if (socket.readyState !== WebSocket.OPEN) {
        throw new EngineError("not_connected", "The connection is closed.");
      }
      socket.send(body);
      emit(owner, connectionId, "outgoing", clip(body));
    },
    close: () => socket.close(1000, "Closed by Aurolis"),
  };
  connections.set(connectionId, connection);

  return new Promise((resolve, reject) => {
    let opened = false;
    socket.on("open", () => {
      opened = true;
      emit(owner, connectionId, "open", `Connected to ${params.url}`);
      resolve();
    });
    socket.on("unexpected-response", (_request, response) => {
      const error = new EngineError(
        "refused",
        unexpectedResponseMessage(response.statusCode),
      );
      socket.terminate();
      reject(error);
    });
    socket.on("message", (data, isBinary) => {
      emit(owner, connectionId, "incoming", rawToText(data, isBinary));
    });
    socket.on("error", (error) => {
      const engineError = toEngineError(error);
      if (opened) emit(owner, connectionId, "error", engineError.message);
      else reject(engineError);
    });
    socket.on("close", (code, reason) => {
      forget(connectionId, connection);
      const text = reason.toString("utf8");
      const detail = text ? `${code} ${text}` : `${code}`;
      if (opened)
        emit(owner, connectionId, "close", `Disconnected (${detail})`);
    });
  });
}

function socketioConnectError(error: Error, path: string) {
  if (error.message === "timeout") {
    return new EngineError(
      "timeout",
      `No Socket.IO handshake. Check the URL and the path (${path}).`,
    );
  }
  return toEngineError(error);
}

function listensTo(events: string[], event: string) {
  return events.length === 0 || events.includes(event);
}

function openSocketio(
  params: RealtimeConnectParams,
  owner: WebContents,
): Promise<void> {
  const { connectionId } = params;
  const socket: Socket = io(toSocketioUrl(params.url), {
    path: params.socketioPath,
    extraHeaders: headerObject(params.headers),
    reconnection: false,
    forceNew: true,
    timeout: params.timeoutMs,
  });
  const connection: Connection = {
    owner,
    send: ({ event, body, format }) => {
      if (!event.trim()) {
        throw new EngineError("invalid_input", "Enter an event name.");
      }
      if (!socket.connected) {
        throw new EngineError("not_connected", "The connection is closed.");
      }
      const payload = format === "json" ? parseJsonMessage(body) : body;
      socket.emit(event, payload);
      emit(owner, connectionId, "outgoing", clip(body), event);
    },
    close: () => {
      socket.disconnect();
    },
  };
  connections.set(connectionId, connection);

  return new Promise((resolve, reject) => {
    let opened = false;
    socket.on("connect", () => {
      opened = true;
      emit(
        owner,
        connectionId,
        "open",
        `Connected to ${params.url} (id ${socket.id ?? "unknown"})`,
      );
      resolve();
    });
    socket.on("connect_error", (error) => {
      forget(connectionId, connection);
      socket.disconnect();
      if (opened) emit(owner, connectionId, "error", error.message);
      else reject(socketioConnectError(error, params.socketioPath));
    });
    socket.on("disconnect", (reason) => {
      forget(connectionId, connection);
      if (opened)
        emit(owner, connectionId, "close", `Disconnected (${reason})`);
    });
    socket.onAny((event: string, ...args: unknown[]) => {
      if (!listensTo(params.socketioEvents, event)) return;
      emit(owner, connectionId, "incoming", stringifyArgs(args), event);
    });
  });
}

export async function connectRealtime(params: unknown, owner: WebContents) {
  const input: RealtimeConnectParams = parseInput(
    realtimeConnectSchema,
    params,
  );
  connections.get(input.connectionId)?.close();
  connections.delete(input.connectionId);
  watchOwner(owner);
  try {
    if (input.protocol === "socketio") await openSocketio(input, owner);
    else await openWebsocket(input, owner);
  } catch (error) {
    connections.get(input.connectionId)?.close();
    connections.delete(input.connectionId);
    throw error;
  }
}

export async function sendRealtime(params: unknown) {
  const input: RealtimeSendParams = parseInput(realtimeSendSchema, params);
  const connection = connections.get(input.connectionId);
  if (!connection) {
    throw new EngineError("not_connected", "Connect before sending.");
  }
  connection.send(input);
}

export async function disconnectRealtime(connectionId: unknown) {
  const id = parseInput(runIdParamSchema, connectionId);
  const connection = connections.get(id);
  if (!connection) return;
  connection.close();
}
