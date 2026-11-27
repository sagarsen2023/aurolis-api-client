import type { Collection, Folder } from "../types/workspace/collection.type.ts";
import type { Environment } from "../types/workspace/environment.type.ts";
import type {
  ApiRequest,
  KeyValue,
  RequestAuth,
  RequestExample,
} from "../types/workspace/request.type.ts";
import { stripJsonComments } from "./jsonc.ts";

export const OPENAPI_VERSION = "3.0.3";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export interface OpenApiOptions {
  title: string;
  description?: string;
  version?: string;
  environment?: Environment | null;
}

export interface OpenApiResult {
  document: JsonObject;
  operations: number;
  skippedRequests: number;
  mergedRequests: number;
}

interface Located {
  collection: Collection;
  folders: Folder[];
  request: ApiRequest;
}

interface Target {
  server: string | null;
  path: string;
  query: KeyValue[];
  pathParams: string[];
}

const VARIABLE = /\{\{\s*([^{}\s]+)\s*\}\}/g;
const LEADING_VARIABLE = /^\{\{\s*([^{}\s]+)\s*\}\}/;
const RESERVED_HEADERS = new Set(["authorization", "content-type", "accept"]);
const OPENAPI_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);

function walk(
  collection: Collection,
  items: Collection["items"],
  folders: Folder[],
  into: Located[],
) {
  for (const item of [...items].sort((a, b) => a.seq - b.seq)) {
    if (item.type === "folder") {
      walk(collection, item.items, [...folders, item], into);
    } else {
      into.push({ collection, folders, request: item });
    }
  }
}

function effectiveAuth(located: Located): RequestAuth {
  if (located.request.auth.type !== "inherit") return located.request.auth;
  for (const folder of [...located.folders].reverse()) {
    if (folder.auth.type !== "inherit") return folder.auth;
  }
  const auth = located.collection.auth;
  return auth.type === "inherit" ? { type: "none" } : auth;
}

function toOpenApiPath(path: string, params: Set<string>) {
  return path
    .split("/")
    .map((segment) => {
      const colon = /^:([A-Za-z_][\w-]*)$/.exec(segment);
      if (colon) {
        params.add(colon[1]);
        return `{${colon[1]}}`;
      }
      return segment.replace(VARIABLE, (_match, name: string) => {
        params.add(name);
        return `{${name}}`;
      });
    })
    .join("/");
}

function splitQuery(rest: string): { path: string; query: KeyValue[] } {
  const hash = rest.indexOf("#");
  const withoutHash = hash === -1 ? rest : rest.slice(0, hash);
  const mark = withoutHash.indexOf("?");
  if (mark === -1) return { path: withoutHash, query: [] };
  const query = withoutHash
    .slice(mark + 1)
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const equals = pair.indexOf("=");
      const key = equals === -1 ? pair : pair.slice(0, equals);
      const value = equals === -1 ? "" : pair.slice(equals + 1);
      return {
        key: safeDecode(key),
        value: safeDecode(value),
        enabled: true,
      };
    });
  return { path: withoutHash.slice(0, mark), query };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function parseTarget(url: string): Target {
  const trimmed = url.trim();
  let server: string | null = null;
  let rest = trimmed;
  const leading = LEADING_VARIABLE.exec(trimmed);
  if (leading) {
    server = `{${leading[1]}}`;
    rest = trimmed.slice(leading[0].length);
  } else {
    const absolute = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)(.*)$/i.exec(trimmed);
    if (absolute) {
      server = absolute[1];
      rest = absolute[2];
    } else if (!trimmed.startsWith("/")) {
      const hostOnly = /^([^/?#]+)(.*)$/.exec(trimmed);
      if (hostOnly && hostOnly[1].includes(".")) {
        server = `http://${hostOnly[1]}`;
        rest = hostOnly[2];
      }
    }
  }
  const { path, query } = splitQuery(rest);
  const params = new Set<string>();
  const openApiPath = toOpenApiPath(path || "/", params);
  return {
    server,
    path: openApiPath.startsWith("/") ? openApiPath : `/${openApiPath}`,
    query,
    pathParams: [...params],
  };
}

export function parseJsonLoose(raw: string): Json | undefined {
  const text = stripJsonComments(raw).trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as Json;
  } catch {
    return undefined;
  }
}

export function inferSchema(value: Json): JsonObject {
  if (value === null) return { nullable: true };
  if (Array.isArray(value)) {
    return value.length > 0
      ? { type: "array", items: inferSchema(value[0]) }
      : { type: "array", items: {} };
  }
  switch (typeof value) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: Number.isInteger(value) ? "integer" : "number" };
    case "boolean":
      return { type: "boolean" };
    default: {
      const properties: JsonObject = {};
      for (const [key, child] of Object.entries(value)) {
        properties[key] = inferSchema(child);
      }
      return { type: "object", properties };
    }
  }
}

function contentTypeOf(headers: KeyValue[]) {
  const header = headers.find(
    (entry) => entry.enabled && entry.key.toLowerCase() === "content-type",
  );
  return header?.value.split(";")[0].trim().toLowerCase() || null;
}

function mediaFor(body: string, declared: string | null): [string, JsonObject] {
  const parsed = parseJsonLoose(body);
  const isJson =
    declared === null
      ? parsed !== undefined
      : declared.includes("json") && parsed !== undefined;
  if (isJson && parsed !== undefined) {
    return [
      declared ?? "application/json",
      { schema: inferSchema(parsed), example: parsed },
    ];
  }
  return [
    declared ?? "text/plain",
    { schema: { type: "string" }, ...(body ? { example: body } : {}) },
  ];
}

function enabled(list: KeyValue[]) {
  return list.filter((entry) => entry.enabled && entry.key.trim());
}

function parameter(
  name: string,
  location: "query" | "header" | "path",
  example: string,
  description?: string,
): JsonObject {
  const value: JsonObject = {
    name,
    in: location,
    required: location === "path",
    schema: { type: "string" },
  };
  if (example) value.example = example;
  if (description) value.description = description;
  return value;
}

function variableHint(value: string) {
  const names = [...value.matchAll(VARIABLE)].map((match) => match[1]);
  return names.length > 0
    ? `Set from ${names.map((name) => `{{${name}}}`).join(", ")} in Aurolis.`
    : undefined;
}

function requestBody(request: ApiRequest): JsonObject | null {
  if (request.protocol === "graphql") {
    const variables = parseJsonLoose(request.graphql.variables);
    const example: JsonObject = { query: request.graphql.query };
    if (variables !== undefined) example.variables = variables;
    if (request.graphql.operationName) {
      example.operationName = request.graphql.operationName;
    }
    return {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["query"],
            properties: {
              query: { type: "string" },
              variables: { type: "object" },
              operationName: { type: "string" },
            },
          },
          example,
        },
      },
    };
  }
  if (request.protocol !== "http") return null;
  const body = request.body;
  switch (body.mode) {
    case "json":
    case "text":
    case "xml": {
      const declared =
        contentTypeOf(request.headers) ??
        {
          json: "application/json",
          text: "text/plain",
          xml: "application/xml",
        }[body.mode];
      const [type, media] = mediaFor(body.raw, declared);
      return { required: true, content: { [type]: media } };
    }
    case "urlencoded":
    case "form-data": {
      const fields = enabled(body.fields);
      const properties: JsonObject = {};
      const example: JsonObject = {};
      for (const field of fields) {
        properties[field.key] = { type: "string" };
        example[field.key] = field.value;
      }
      const type =
        body.mode === "urlencoded"
          ? "application/x-www-form-urlencoded"
          : "multipart/form-data";
      return {
        required: true,
        content: {
          [type]: { schema: { type: "object", properties }, example },
        },
      };
    }
    default:
      return null;
  }
}

function responses(examples: RequestExample[]): JsonObject {
  if (examples.length === 0) {
    return { default: { description: "No saved response example." } };
  }
  const byStatus = new Map<number, RequestExample[]>();
  for (const example of [...examples].sort((a, b) => a.seq - b.seq)) {
    byStatus.set(example.status, [
      ...(byStatus.get(example.status) ?? []),
      example,
    ]);
  }
  const result: JsonObject = {};
  for (const [status, group] of [...byStatus].sort((a, b) => a[0] - b[0])) {
    const content: Record<string, JsonObject> = {};
    for (const example of group) {
      const [type, media] = mediaFor(
        example.body,
        contentTypeOf(example.headers),
      );
      const existing = content[type];
      const named = {
        summary: example.name,
        value: media.example ?? example.body,
      };
      if (!existing) {
        content[type] = {
          schema: media.schema,
          examples: { [exampleKey(example.name, {})]: named },
        };
      } else {
        const bag = existing.examples as JsonObject;
        bag[exampleKey(example.name, bag)] = named;
      }
    }
    const headers: JsonObject = {};
    for (const header of enabled(group[0].headers)) {
      if (header.key.toLowerCase() === "content-type") continue;
      headers[header.key] = {
        schema: { type: "string" },
        example: header.value,
      };
    }
    result[String(status)] = {
      description: group.map((example) => example.name).join(" · "),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      ...(group.some((example) => example.body) ? { content } : {}),
    };
  }
  return result;
}

function exampleKey(name: string, taken: JsonObject) {
  const base =
    name
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "example";
  let key = base;
  for (let n = 2; key in taken; n++) key = `${base}-${n}`;
  return key;
}

function operationIdOf(name: string, taken: Set<string>) {
  const words = name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const base =
    words
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word[0].toUpperCase() + word.slice(1).toLowerCase(),
      )
      .join("") || "operation";
  const safe = /^[0-9]/.test(base) ? `op${base}` : base;
  let id = safe;
  for (let n = 2; taken.has(id); n++) id = `${safe}${n}`;
  taken.add(id);
  return id;
}

interface SecurityRegistry {
  schemes: JsonObject;
  keys: Map<string, string>;
}

function securityFor(
  auth: RequestAuth,
  registry: SecurityRegistry,
): Json[] | null {
  let signature: string;
  let scheme: JsonObject;
  let base: string;
  switch (auth.type) {
    case "bearer":
      signature = "bearer";
      scheme = { type: "http", scheme: "bearer" };
      base = "bearerAuth";
      break;
    case "basic":
      signature = "basic";
      scheme = { type: "http", scheme: "basic" };
      base = "basicAuth";
      break;
    case "apikey": {
      const name = auth.key.trim() || "X-API-Key";
      signature = `apikey:${auth.in}:${name}`;
      scheme = { type: "apiKey", in: auth.in, name };
      base = "apiKeyAuth";
      break;
    }
    default:
      return [];
  }
  let key = registry.keys.get(signature);
  if (!key) {
    key = base;
    for (let n = 2; key in registry.schemes; n++) key = `${base}${n}`;
    registry.schemes[key] = scheme;
    registry.keys.set(signature, key);
  }
  return [{ [key]: [] }];
}

function variableValue(
  name: string,
  environment: Environment | null | undefined,
  collections: Collection[],
) {
  const fromEnvironment = environment?.variables.find(
    (variable) => variable.enabled && variable.key === name,
  );
  if (fromEnvironment && !fromEnvironment.secret && fromEnvironment.value) {
    return fromEnvironment.value;
  }
  for (const collection of collections) {
    const variable = collection.variables.find(
      (entry) => entry.enabled && entry.key === name,
    );
    if (variable?.value) return variable.value;
  }
  return null;
}

function serverObject(
  server: string,
  options: OpenApiOptions,
  collections: Collection[],
): JsonObject {
  const variable = /^\{([^{}]+)\}$/.exec(server);
  if (!variable) return { url: server };
  const value = variableValue(variable[1], options.environment, collections);
  const fallback = value?.replace(/\/+$/, "") || "https://api.example.com";
  return {
    url: server,
    description: options.environment
      ? `{{${variable[1]}}} from the ${options.environment.name} environment`
      : `{{${variable[1]}}} in Aurolis`,
    variables: { [variable[1]]: { default: fallback } },
  };
}

function tagOf(located: Located, multiple: boolean) {
  const parts = [
    ...(multiple ? [located.collection.name] : []),
    ...located.folders.map((folder) => folder.name),
  ];
  return parts.length > 0 ? parts.join(" / ") : located.collection.name;
}

export function buildOpenApi(
  collections: Collection[],
  options: OpenApiOptions,
): OpenApiResult {
  const located: Located[] = [];
  for (const collection of [...collections].sort((a, b) => a.seq - b.seq)) {
    walk(collection, collection.items, [], located);
  }
  const multiple = collections.length > 1;
  const paths: Record<string, JsonObject> = {};
  const tags = new Map<string, string>();
  const operationIds = new Set<string>();
  const registry: SecurityRegistry = { schemes: {}, keys: new Map() };
  const serverCounts = new Map<string, number>();
  const operationServers = new Map<JsonObject, string | null>();
  let skippedRequests = 0;
  let mergedRequests = 0;
  let operations = 0;

  for (const entry of located) {
    const { request } = entry;
    if (request.protocol !== "http" && request.protocol !== "graphql") {
      skippedRequests += 1;
      continue;
    }
    const method =
      request.protocol === "http" ? request.method.toLowerCase() : "post";
    if (!OPENAPI_METHODS.has(method)) {
      skippedRequests += 1;
      continue;
    }
    const target = parseTarget(request.url);
    const pathItem = (paths[target.path] ??= {});
    const existing = pathItem[method] as JsonObject | undefined;
    if (existing) {
      mergedRequests += 1;
      const current = existing.responses as JsonObject;
      for (const [status, response] of Object.entries(
        responses(request.examples),
      )) {
        if (status !== "default" && !(status in current)) {
          current[status] = response;
        }
      }
      if ("default" in current && Object.keys(current).length > 1) {
        delete current.default;
      }
      existing.description = [
        existing.description,
        `Also saved in Aurolis as "${request.name}".`,
      ]
        .filter(Boolean)
        .join("\n\n");
      continue;
    }

    const tag = tagOf(entry, multiple);
    if (!tags.has(tag)) {
      const folder = entry.folders.at(-1);
      tags.set(tag, folder ? folder.description : entry.collection.description);
    }

    const parameters: Json[] = [
      ...target.pathParams.map((name) =>
        parameter(
          name,
          "path",
          variableValue(name, options.environment, collections) ?? "",
          `Set from {{${name}}} in Aurolis.`,
        ),
      ),
    ];
    const seenQuery = new Set<string>();
    for (const query of [...target.query, ...enabled(request.params)]) {
      if (seenQuery.has(query.key)) continue;
      seenQuery.add(query.key);
      parameters.push(
        parameter(query.key, "query", query.value, variableHint(query.value)),
      );
    }
    for (const header of enabled(request.headers)) {
      if (RESERVED_HEADERS.has(header.key.toLowerCase())) continue;
      parameters.push(
        parameter(
          header.key,
          "header",
          header.value,
          variableHint(header.value),
        ),
      );
    }

    const operation: JsonObject = {
      tags: [tag],
      summary: request.name,
      operationId: operationIdOf(request.name, operationIds),
    };
    const description = [
      request.description.trim(),
      request.protocol === "graphql" ? "GraphQL operation." : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (description) operation.description = description;
    if (parameters.length > 0) operation.parameters = parameters;
    const body = requestBody(request);
    if (body) operation.requestBody = body;
    operation.responses = responses(request.examples);
    const security = securityFor(effectiveAuth(entry), registry);
    if (security && security.length > 0) operation.security = security;

    pathItem[method] = operation;
    operationServers.set(operation, target.server);
    if (target.server) {
      serverCounts.set(
        target.server,
        (serverCounts.get(target.server) ?? 0) + 1,
      );
    }
    operations += 1;
  }

  const ranked = [...serverCounts].sort((a, b) => b[1] - a[1]);
  const primary = ranked[0]?.[0] ?? null;
  for (const [operation, server] of operationServers) {
    if (server && server !== primary) {
      operation.servers = [serverObject(server, options, collections)];
    }
  }

  const sortedPaths: JsonObject = {};
  for (const path of Object.keys(paths).sort()) sortedPaths[path] = paths[path];

  const document: JsonObject = {
    openapi: OPENAPI_VERSION,
    info: {
      title: options.title,
      version: options.version ?? "1.0.0",
      ...(options.description?.trim()
        ? { description: options.description.trim() }
        : {}),
    },
    servers: primary ? [serverObject(primary, options, collections)] : [],
    tags: [...tags].map(([name, text]): JsonObject =>
      text.trim() ? { name, description: text.trim() } : { name },
    ),
    paths: sortedPaths,
  };
  if (document.servers && (document.servers as Json[]).length === 0) {
    delete document.servers;
  }
  if (Object.keys(registry.schemes).length > 0) {
    document.components = { securitySchemes: registry.schemes };
  }
  return { document, operations, skippedRequests, mergedRequests };
}
