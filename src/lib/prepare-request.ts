import type { HeaderPair } from "../types/engine/engine.type.ts";
import type { PreparedBody } from "../types/engine/http-engine.type.ts";
import type { Collection, Folder } from "../types/workspace/collection.type.ts";
import type {
  SavedRequest,
  SavedRequestOf,
} from "../types/workspace/collection-ops.type.ts";
import type { Environment } from "../types/workspace/environment.type.ts";
import type {
  GraphqlOperation,
  KeyValue,
  RequestAuth,
  RequestBody,
} from "../types/workspace/request.type.ts";
import { buildScope, resolveText, type VariableScope } from "./variables.ts";

const BODY_CONTENT_TYPES: Record<string, string> = {
  json: "application/json",
  text: "text/plain",
  xml: "application/xml",
};

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

export interface RequestContext {
  collection: Collection;
  folders: Folder[];
  environment: Environment | null;
  globals: Environment | null;
}

export interface PreparedTarget {
  url: string;
  headers: HeaderPair[];
  unresolved: string[];
}

export interface PreparedHttp extends PreparedTarget {
  body: PreparedBody;
}

export interface PreparedGraphql extends PreparedTarget {
  operation: GraphqlOperation;
}

type Resolver = (text: string) => string;

function contextScope(context: RequestContext): VariableScope {
  return buildScope(
    context.environment?.variables,
    context.collection.variables,
    context.globals?.variables,
  );
}

function effectiveAuth(
  auth: RequestAuth,
  context: Pick<RequestContext, "collection" | "folders">,
): RequestAuth {
  if (auth.type !== "inherit") return auth;
  for (const folder of [...context.folders].reverse()) {
    if (folder.auth.type !== "inherit") return folder.auth;
  }
  const collectionAuth = context.collection.auth;
  return collectionAuth.type === "inherit" ? { type: "none" } : collectionAuth;
}

function enabledPairs(list: KeyValue[], resolve: Resolver): HeaderPair[] {
  return list
    .filter((entry) => entry.enabled && entry.key.trim())
    .map((entry): HeaderPair => [
      resolve(entry.key.trim()),
      resolve(entry.value),
    ]);
}

function hasHeader(headers: HeaderPair[], name: string) {
  const lower = name.toLowerCase();
  return headers.some(([key]) => key.toLowerCase() === lower);
}

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function withScheme(url: string, fallbackScheme: string) {
  const trimmed = url.trim();
  if (!trimmed || SCHEME_PATTERN.test(trimmed)) return trimmed;
  return `${fallbackScheme}://${trimmed}`;
}

function appendQuery(url: string, pairs: HeaderPair[]) {
  if (pairs.length === 0) return url;
  try {
    const parsed = new URL(url);
    for (const [key, value] of pairs) parsed.searchParams.append(key, value);
    return parsed.toString();
  } catch {
    const query = new URLSearchParams(pairs).toString();
    return `${url}${url.includes("?") ? "&" : "?"}${query}`;
  }
}

function authHeaders(auth: RequestAuth, resolve: Resolver): HeaderPair[] {
  switch (auth.type) {
    case "bearer":
      return [["Authorization", `Bearer ${resolve(auth.token)}`]];
    case "basic": {
      const credentials = `${resolve(auth.username)}:${resolve(auth.password)}`;
      return [["Authorization", `Basic ${toBase64(credentials)}`]];
    }
    case "apikey":
      return auth.in === "header" && auth.key.trim()
        ? [[resolve(auth.key.trim()), resolve(auth.value)]]
        : [];
    default:
      return [];
  }
}

function authQuery(auth: RequestAuth, resolve: Resolver): HeaderPair[] {
  if (auth.type !== "apikey" || auth.in !== "query" || !auth.key.trim()) {
    return [];
  }
  return [[resolve(auth.key.trim()), resolve(auth.value)]];
}

function prepareTarget(
  request: SavedRequest,
  context: RequestContext,
  fallbackScheme: string,
): { target: PreparedTarget; resolve: Resolver; unresolved: Set<string> } {
  const scope = contextScope(context);
  const unresolved = new Set<string>();
  const resolve: Resolver = (text) => resolveText(text, scope, unresolved);
  const auth = effectiveAuth(request.auth, context);
  const query = [
    ...enabledPairs(request.params, resolve),
    ...authQuery(auth, resolve),
  ];
  const url = appendQuery(
    withScheme(resolve(request.url), fallbackScheme),
    query,
  );
  const headers = [...enabledPairs(request.headers, resolve)];
  for (const header of authHeaders(auth, resolve)) {
    if (!hasHeader(headers, header[0])) headers.push(header);
  }
  return {
    target: { url, headers, unresolved: [] },
    resolve,
    unresolved,
  };
}

function prepareBody(
  body: RequestBody,
  headers: HeaderPair[],
  resolve: Resolver,
): PreparedBody {
  switch (body.mode) {
    case "json":
    case "text":
    case "xml":
      if (!hasHeader(headers, "content-type")) {
        headers.push(["Content-Type", BODY_CONTENT_TYPES[body.mode]]);
      }
      return { kind: "text", text: resolve(body.raw) };
    case "urlencoded":
      return { kind: "urlencoded", fields: enabledPairs(body.fields, resolve) };
    case "form-data":
      return { kind: "form-data", fields: enabledPairs(body.fields, resolve) };
    default:
      return { kind: "none" };
  }
}

export function prepareHttp(
  request: SavedRequestOf<"http">,
  context: RequestContext,
): PreparedHttp {
  const { target, resolve, unresolved } = prepareTarget(
    request,
    context,
    "http",
  );
  const body = prepareBody(request.body, target.headers, resolve);
  return { ...target, body, unresolved: [...unresolved] };
}

export function prepareGraphql(
  request: SavedRequestOf<"graphql">,
  context: RequestContext,
): PreparedGraphql {
  const { target, resolve, unresolved } = prepareTarget(
    request,
    context,
    "http",
  );
  const operation: GraphqlOperation = {
    query: request.graphql.query,
    variables: resolve(request.graphql.variables),
    operationName: request.graphql.operationName,
  };
  return { ...target, operation, unresolved: [...unresolved] };
}

export function prepareRealtime(
  request: SavedRequestOf<"websocket" | "socketio">,
  context: RequestContext,
): PreparedTarget & { resolve: Resolver } {
  const scheme = request.protocol === "socketio" ? "http" : "ws";
  const { target, resolve, unresolved } = prepareTarget(
    request,
    context,
    scheme,
  );
  return { ...target, unresolved: [...unresolved], resolve };
}
