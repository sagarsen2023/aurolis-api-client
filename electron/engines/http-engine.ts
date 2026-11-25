import { performance } from "node:perf_hooks";
import type { HeaderPair } from "../../src/types/engine/engine.type.ts";
import type {
  BodyEncoding,
  HttpResponseData,
  HttpSendParams,
  PreparedBody,
} from "../../src/types/engine/http-engine.type.ts";
import type { HttpMethod } from "../../src/types/workspace/request.type.ts";
import {
  httpSendSchema,
  runIdParamSchema,
} from "../../src/validators/engine.schema.ts";
import { EngineError, parseInput, toEngineError } from "./engine-error.ts";

const MAX_TEXT_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BODYLESS_METHODS = new Set<HttpMethod>(["GET", "HEAD"]);
const TEXT_TYPE =
  /^(text\/|application\/([\w.+-]*\+)?(json|xml|javascript|ecmascript|graphql|x-www-form-urlencoded|x-ndjson|yaml|x-yaml|problem\+json)\b)/i;

export interface HttpExchange {
  method: HttpMethod;
  url: string;
  headers: HeaderPair[];
  body: PreparedBody;
  timeoutMs: number;
}

type CollectedBody = { bytes: Uint8Array; size: number; truncated: boolean };

const runs = new Map<string, AbortController>();

function formatSeconds(ms: number) {
  const seconds = ms / 1000;
  const text = Number.isInteger(seconds) ? `${seconds}` : seconds.toFixed(1);
  return `${text} second${seconds === 1 ? "" : "s"}`;
}

function toFetchBody(body: PreparedBody): RequestInit["body"] {
  switch (body.kind) {
    case "text":
      return body.text;
    case "urlencoded":
      return new URLSearchParams(body.fields);
    case "form-data": {
      const form = new FormData();
      for (const [name, value] of body.fields) form.append(name, value);
      return form;
    }
    default:
      return undefined;
  }
}

async function collectBody(response: Response): Promise<CollectedBody> {
  if (!response.body) {
    return { bytes: new Uint8Array(), size: 0, truncated: false };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let kept = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (kept + value.byteLength > MAX_TEXT_BYTES) {
      truncated = true;
      chunks.push(value.subarray(0, MAX_TEXT_BYTES - kept));
      await reader.cancel();
      break;
    }
    chunks.push(value);
    kept += value.byteLength;
  }
  return { bytes: Buffer.concat(chunks), size, truncated };
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function decodeBody(
  bytes: Uint8Array,
  contentType: string | null,
): { body: string; bodyEncoding: BodyEncoding } {
  const isText = contentType ? TEXT_TYPE.test(contentType) : false;
  if (isText) {
    return {
      body: new TextDecoder("utf-8").decode(bytes),
      bodyEncoding: "text",
    };
  }
  const isImage = contentType?.toLowerCase().startsWith("image/") ?? false;
  if (isImage && bytes.byteLength <= MAX_IMAGE_BYTES) {
    return {
      body: Buffer.from(bytes).toString("base64"),
      bodyEncoding: "base64",
    };
  }
  const text = contentType ? null : decodeUtf8(bytes);
  if (text !== null) return { body: text, bodyEncoding: "text" };
  return { body: "", bodyEncoding: "omitted" };
}

function responseHeaders(response: Response): HeaderPair[] {
  const pairs: HeaderPair[] = [];
  response.headers.forEach((value, name) => pairs.push([name, value]));
  const cookies = response.headers.getSetCookie();
  if (cookies.length === 0) return pairs;
  const withoutCookies = pairs.filter(([name]) => name !== "set-cookie");
  const cookiePairs = cookies.map((cookie): HeaderPair => [
    "set-cookie",
    cookie,
  ]);
  return [...withoutCookies, ...cookiePairs];
}

function abortError(controller: AbortController, caught: unknown) {
  const reason: unknown = controller.signal.reason;
  if (reason instanceof EngineError) return reason;
  if (controller.signal.aborted) {
    return new EngineError("aborted", "The request was cancelled.");
  }
  return toEngineError(caught);
}

export async function executeHttp(
  exchange: HttpExchange,
  runId?: string,
): Promise<HttpResponseData> {
  const controller = new AbortController();
  if (runId) runs.set(runId, controller);
  const timer = setTimeout(() => {
    const message = `No response within ${formatSeconds(exchange.timeoutMs)}.`;
    controller.abort(new EngineError("timeout", message));
  }, exchange.timeoutMs);
  const started = performance.now();
  try {
    const sendsBody = !BODYLESS_METHODS.has(exchange.method);
    const response = await fetch(exchange.url, {
      method: exchange.method,
      headers: exchange.headers,
      body: sendsBody ? toFetchBody(exchange.body) : undefined,
      redirect: "follow",
      signal: controller.signal,
    });
    const headersMs = performance.now() - started;
    const collected = await collectBody(response);
    const totalMs = performance.now() - started;
    const contentType = response.headers.get("content-type");
    const decoded = decodeBody(collected.bytes, contentType);
    return {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      redirected: response.redirected,
      headers: responseHeaders(response),
      contentType,
      ...decoded,
      size: collected.size,
      truncated: collected.truncated,
      timings: { headersMs, totalMs },
    };
  } catch (caught) {
    throw abortError(controller, caught);
  } finally {
    clearTimeout(timer);
    if (runId) runs.delete(runId);
  }
}

export function sendHttp(params: unknown): Promise<HttpResponseData> {
  const input: HttpSendParams = parseInput(httpSendSchema, params);
  return executeHttp(input, input.runId);
}

export function cancelRun(runId: unknown) {
  const id = parseInput(runIdParamSchema, runId);
  runs.get(id)?.abort();
}
