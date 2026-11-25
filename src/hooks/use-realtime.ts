import { useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  realtimeSessionsAtom,
  type RealtimeSession,
} from "@/context/collections-context";
import { requestTimeoutAtom } from "@/context/settings-atoms";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { prepareRealtime } from "@/lib/prepare-request";
import { newRunId } from "@/services/config/engine-bridge";
import { realtimeEngineService } from "@/services/realtime-engine.service";
import type { RealtimeEvent } from "@/types/engine/realtime-engine.type";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";
import type { MessageFormat } from "@/types/workspace/request.type";
import { useRequestContext } from "./use-request-context";

const MAX_EVENTS = 1000;

const DISCONNECTED: RealtimeSession = {
  status: "disconnected",
  connectionId: null,
  events: [],
};

type RealtimeLike = Extract<
  SavedRequest,
  { protocol: "websocket" | "socketio" }
>;

function applyEvent(session: RealtimeSession, event: RealtimeEvent) {
  const events = [...session.events, event].slice(-MAX_EVENTS);
  const closed = event.kind === "close";
  return {
    ...session,
    events,
    status: closed ? "disconnected" : session.status,
    connectionId: closed ? null : session.connectionId,
  } satisfies RealtimeSession;
}

function systemEvent(connectionId: string, data: string): RealtimeEvent {
  return {
    connectionId,
    id: crypto.randomUUID(),
    kind: "error",
    at: Date.now(),
    event: null,
    data,
  };
}

export function useRealtimeEventsListener() {
  const setSessions = useSetAtom(realtimeSessionsAtom);
  const workspace = useAtomValue(activeWorkspaceAtom);
  const workspaceId = workspace?.entry.id ?? null;
  const sessionsRef = useRef<Record<string, RealtimeSession>>({});
  const sessions = useAtomValue(realtimeSessionsAtom);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(
    () =>
      realtimeEngineService.onEvent((event) => {
        setSessions((current) => {
          const entry = Object.entries(current).find(
            ([, session]) => session.connectionId === event.connectionId,
          );
          if (!entry) return current;
          const [requestId, session] = entry;
          return { ...current, [requestId]: applyEvent(session, event) };
        });
      }),
    [setSessions],
  );

  useEffect(() => {
    return () => {
      for (const session of Object.values(sessionsRef.current)) {
        if (!session.connectionId) continue;
        void realtimeEngineService
          .disconnect(session.connectionId)
          .catch(() => undefined);
      }
      setSessions({});
    };
  }, [workspaceId, setSessions]);
}

export function useRealtimeSession(requestId: string) {
  const [sessions, setSessions] = useAtom(realtimeSessionsAtom);
  const timeoutSeconds = useAtomValue(requestTimeoutAtom);
  const getContext = useRequestContext(requestId);
  const session = sessions[requestId] ?? DISCONNECTED;

  const update = useCallback(
    (updater: (session: RealtimeSession) => RealtimeSession) =>
      setSessions((current) => ({
        ...current,
        [requestId]: updater(current[requestId] ?? DISCONNECTED),
      })),
    [requestId, setSessions],
  );

  const connect = useCallback(
    async (request: RealtimeLike) => {
      const connectionId = newRunId();
      const prepared = prepareRealtime(request, getContext());
      update((current) => ({ ...current, status: "connecting", connectionId }));
      try {
        await realtimeEngineService.connect({
          connectionId,
          protocol: request.protocol,
          url: prepared.url,
          headers: prepared.headers,
          socketioPath:
            request.protocol === "socketio" ? request.socketio.path : "/",
          socketioEvents:
            request.protocol === "socketio" ? request.socketio.events : [],
          timeoutMs: Number(timeoutSeconds) * 1000,
        });
        update((current) =>
          current.connectionId === connectionId
            ? { ...current, status: "connected" }
            : current,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Couldn't connect.";
        update((current) => ({
          status: "disconnected",
          connectionId: null,
          events: [...current.events, systemEvent(connectionId, message)].slice(
            -MAX_EVENTS,
          ),
        }));
      }
    },
    [getContext, timeoutSeconds, update],
  );

  const disconnect = useCallback(async () => {
    if (!session.connectionId) return;
    await realtimeEngineService.disconnect(session.connectionId);
  }, [session.connectionId]);

  const send = useCallback(
    async (
      request: RealtimeLike,
      message: { event: string; body: string; format: MessageFormat },
    ) => {
      if (!session.connectionId) throw new Error("Connect first.");
      const prepared = prepareRealtime(request, getContext());
      await realtimeEngineService.send({
        connectionId: session.connectionId,
        event: prepared.resolve(message.event),
        body: prepared.resolve(message.body),
        format: message.format,
      });
    },
    [getContext, session.connectionId],
  );

  const clear = useCallback(
    () => update((current) => ({ ...current, events: [] })),
    [update],
  );

  return { session, connect, disconnect, send, clear };
}
