import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { HTTP_STATUS_TEXT } from "@/constants/http-status";
import {
  addNote,
  exampleStatus,
  fromAngleVariables,
  itemName,
  mapAuthText,
  mapRequestText,
  mergeBundles,
  newId,
  sequence,
  text,
  toHttpMethod,
} from "@/lib/transfer";
import { slugify } from "@/lib/workspace-format";
import type {
  ExportFile,
  ExportSelection,
  ImportBundle,
  ImportNotes,
  ImportSource,
} from "@/types/transfer/transfer.type";
import type {
  Collection,
  CollectionItem,
} from "@/types/workspace/collection.type";
import type { Environment } from "@/types/workspace/environment.type";
import type {
  ApiRequest,
  KeyValue,
  RequestAuth,
  RequestBody,
  RequestExample,
} from "@/types/workspace/request.type";

const COLLECTION_SCHEMA =
  "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

type Json = Record<string, unknown>;

type PostmanBody =
  | { kind: "body"; body: RequestBody }
  | { kind: "graphql"; query: string; variables: string };

const record = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

function readDescription(value: unknown) {
  return typeof value === "string" ? value : text(record(value).content);
}

function readPairs(value: unknown): KeyValue[] {
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const colon = line.indexOf(":");
        return colon === -1
          ? { key: line, value: "", enabled: true }
          : {
              key: line.slice(0, colon).trim(),
              value: line.slice(colon + 1).trim(),
              enabled: true,
            };
      });
  }
  return list(value)
    .map(record)
    .filter((pair) => text(pair.key) || text(pair.value))
    .map((pair) => ({
      key: text(pair.key),
      value: text(pair.value),
      enabled: pair.disabled !== true,
    }));
}

function splitQuery(raw: string) {
  const hash = raw.indexOf("#");
  const withoutHash = hash === -1 ? raw : raw.slice(0, hash);
  const question = withoutHash.indexOf("?");
  if (question === -1) return { url: withoutHash, params: [] };
  const params = withoutHash
    .slice(question + 1)
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const equals = pair.indexOf("=");
      return equals === -1
        ? { key: pair, value: "", enabled: true }
        : {
            key: pair.slice(0, equals),
            value: pair.slice(equals + 1),
            enabled: true,
          };
    });
  return { url: withoutHash.slice(0, question), params };
}

function joinUrlParts(url: Json) {
  const join = (value: unknown, separator: string) =>
    Array.isArray(value)
      ? value.map((part) => text(record(part).value || part)).join(separator)
      : text(value);
  const protocol = text(url.protocol);
  const host = join(url.host, ".");
  const port = text(url.port);
  const path = join(url.path, "/");
  return `${protocol ? `${protocol}://` : ""}${host}${port ? `:${port}` : ""}${
    path ? `/${path}` : ""
  }`;
}

function readUrl(value: unknown) {
  if (typeof value === "string") return splitQuery(value);
  const url = record(value);
  const split = splitQuery(text(url.raw) || joinUrlParts(url));
  if (!Array.isArray(url.query)) return split;
  return { url: split.url, params: readPairs(url.query) };
}

function authAttribute(auth: Json, type: string, key: string) {
  const attributes = auth[type];
  if (Array.isArray(attributes)) {
    return text(
      attributes.map(record).find((attribute) => attribute.key === key)?.value,
    );
  }
  return text(record(attributes)[key]);
}

function readAuth(
  value: unknown,
  absent: RequestAuth,
  notes: ImportNotes,
): RequestAuth {
  const auth = record(value);
  const type = text(auth.type);
  switch (type) {
    case "":
      return absent;
    case "noauth":
      return { type: "none" };
    case "bearer":
      return { type: "bearer", token: authAttribute(auth, type, "token") };
    case "basic":
      return {
        type: "basic",
        username: authAttribute(auth, type, "username"),
        password: authAttribute(auth, type, "password"),
      };
    case "apikey":
      return {
        type: "apikey",
        key: authAttribute(auth, type, "key"),
        value: authAttribute(auth, type, "value"),
        in: authAttribute(auth, type, "in") === "query" ? "query" : "header",
      };
    default:
      addNote(notes, "unsupported-auth");
      return { type: "none" };
  }
}

function readFields(value: unknown, notes: ImportNotes): KeyValue[] {
  const fields = list(value).map(record);
  const files = fields.filter((field) => field.type === "file");
  addNote(notes, "file-fields", files.length);
  return readPairs(fields.filter((field) => field.type !== "file"));
}

function rawMode(raw: string, language: string): "json" | "xml" | "text" {
  if (language === "json") return "json";
  if (language === "xml") return "xml";
  if (!language && /^\s*[[{]/.test(raw)) return "json";
  return "text";
}

function readBody(value: unknown, notes: ImportNotes): PostmanBody {
  const body = record(value);
  const none: PostmanBody = { kind: "body", body: { mode: "none" } };
  if (body.disabled === true) return none;
  switch (text(body.mode)) {
    case "": {
      return none;
    }
    case "raw": {
      const raw = text(body.raw);
      if (!raw) return none;
      const language = text(record(record(body.options).raw).language);
      return { kind: "body", body: { mode: rawMode(raw, language), raw } };
    }
    case "urlencoded":
      return {
        kind: "body",
        body: { mode: "urlencoded", fields: readPairs(body.urlencoded) },
      };
    case "formdata":
      return {
        kind: "body",
        body: { mode: "form-data", fields: readFields(body.formdata, notes) },
      };
    case "graphql": {
      const graphql = record(body.graphql);
      return {
        kind: "graphql",
        query: text(graphql.query),
        variables: text(graphql.variables),
      };
    }
    default:
      addNote(notes, "unsupported-body");
      return none;
  }
}

function hasScripts(item: Json) {
  return list(item.event).some((event) =>
    list(record(record(event).script).exec).some((line) => text(line).trim()),
  );
}

function readExamples(value: unknown): RequestExample[] {
  return list(value)
    .map(record)
    .map((response, index) => ({
      id: newId(),
      name: itemName(response.name, `Example ${index + 1}`),
      seq: sequence(index),
      status: exampleStatus(response.code),
      headers: readPairs(response.header),
      body: text(response.body),
    }));
}

function readRequest(item: Json, index: number, notes: ImportNotes) {
  const source = item.request;
  const request = typeof source === "string" ? { url: source } : record(source);
  if (hasScripts(item)) addNote(notes, "scripts");
  const { url, params } = readUrl(request.url);
  const body = readBody(request.body, notes);
  const shared = {
    type: "request" as const,
    id: newId(),
    name: itemName(item.name, "Untitled request"),
    seq: sequence(index),
    description: readDescription(request.description ?? item.description),
    url,
    params,
    headers: readPairs(request.header),
    auth: readAuth(request.auth, { type: "inherit" }, notes),
    examples: readExamples(item.response),
  };
  const imported: ApiRequest =
    body.kind === "graphql"
      ? {
          ...shared,
          protocol: "graphql",
          graphql: {
            query: body.query,
            variables: body.variables,
            operationName: "",
          },
        }
      : {
          ...shared,
          protocol: "http",
          method: toHttpMethod(request.method, notes),
          body: body.body,
        };
  return mapRequestText(imported, fromAngleVariables);
}

function readItems(value: unknown, notes: ImportNotes): CollectionItem[] {
  return list(value)
    .map(record)
    .map((item, index): CollectionItem => {
      if (!Array.isArray(item.item)) return readRequest(item, index, notes);
      if (hasScripts(item)) addNote(notes, "scripts");
      if (list(item.variable).length > 0) addNote(notes, "folder-variables");
      return {
        type: "folder",
        id: newId(),
        name: itemName(item.name, "Untitled folder"),
        seq: sequence(index),
        description: readDescription(item.description),
        auth: mapAuthText(
          readAuth(item.auth, { type: "inherit" }, notes),
          fromAngleVariables,
        ),
        items: readItems(item.item, notes),
      };
    });
}

function readCollection(json: Json, notes: ImportNotes): Collection {
  const info = record(json.info);
  if (hasScripts(json)) addNote(notes, "scripts");
  return {
    id: newId(),
    name: itemName(info.name, "Imported collection"),
    seq: sequence(0),
    description: readDescription(info.description),
    auth: mapAuthText(
      readAuth(json.auth, { type: "none" }, notes),
      fromAngleVariables,
    ),
    variables: readPairs(json.variable),
    items: readItems(json.item, notes),
  };
}

function readEnvironment(json: Json) {
  return {
    name: itemName(json.name, "Imported environment"),
    variables: list(json.values)
      .map(record)
      .filter((variable) => text(variable.key))
      .map((variable) => ({
        key: text(variable.key),
        value: text(variable.value),
        enabled: variable.enabled !== false,
        secret: variable.type === "secret",
      })),
  };
}

function readJson(name: string, content: string): ImportBundle {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new Error(`${name} isn't valid JSON.`);
  }
  const root = record(json);
  const notes: ImportNotes = {};
  if (root.info && Array.isArray(root.item)) {
    return {
      collections: [readCollection(root, notes)],
      environments: [],
      notes,
    };
  }
  if (Array.isArray(root.values)) {
    return { collections: [], environments: [readEnvironment(root)], notes };
  }
  throw new Error(
    `${name} isn't a Postman collection or environment. Export it from Postman as Collection v2.1.`,
  );
}

function readZip(source: ImportSource): ImportBundle[] {
  const files = unzipSync(source.bytes, {
    filter: (file) =>
      file.name.endsWith(".json") && !file.name.endsWith("archive.json"),
  });
  const bundles = Object.entries(files).map(([name, bytes]) =>
    readJson(name, strFromU8(bytes)),
  );
  if (bundles.length === 0) {
    throw new Error(`${source.name} has no Postman files in it.`);
  }
  return bundles;
}

export function importPostman(sources: ImportSource[]): ImportBundle {
  return mergeBundles(
    sources.flatMap((source) =>
      isZip(source.bytes)
        ? readZip(source)
        : [readJson(source.name, strFromU8(source.bytes))],
    ),
  );
}

function postmanPairs(pairs: KeyValue[]) {
  return pairs
    .filter((pair) => pair.key || pair.value)
    .map((pair) => ({
      key: pair.key,
      value: pair.value,
      type: "text",
      ...(pair.enabled ? {} : { disabled: true }),
    }));
}

function urlParts(url: string) {
  const match = /^([a-z][\w+.-]*):\/\/(.*)$/i.exec(url);
  const rest = match ? match[2] : url;
  const slash = rest.indexOf("/");
  const authority = slash === -1 ? rest : rest.slice(0, slash);
  const path = slash === -1 ? "" : rest.slice(slash + 1);
  const port = /:(\d+)$/.exec(authority);
  const host = port ? authority.slice(0, port.index) : authority;
  return {
    ...(match ? { protocol: match[1] } : {}),
    ...(host ? { host: host.split(".") } : {}),
    ...(port ? { port: port[1] } : {}),
    path: path ? path.split("/") : [],
  };
}

function postmanUrl(url: string, params: KeyValue[]) {
  const enabled = params.filter((param) => param.enabled && param.key);
  const query = enabled.map((param) => `${param.key}=${param.value}`).join("&");
  const separator = url.includes("?") ? "&" : "?";
  const named = params.filter((param) => param.key);
  return {
    raw: query ? `${url}${separator}${query}` : url,
    ...urlParts(url),
    ...(named.length > 0
      ? {
          query: named.map((param) => ({
            key: param.key,
            value: param.value,
            ...(param.enabled ? {} : { disabled: true }),
          })),
        }
      : {}),
  };
}

function postmanAuth(auth: RequestAuth) {
  const attributes = (entries: Record<string, string>) =>
    Object.entries(entries).map(([key, value]) => ({
      key,
      value,
      type: "string",
    }));
  switch (auth.type) {
    case "inherit":
      return undefined;
    case "none":
      return { type: "noauth" };
    case "bearer":
      return { type: "bearer", bearer: attributes({ token: auth.token }) };
    case "basic":
      return {
        type: "basic",
        basic: attributes({ username: auth.username, password: auth.password }),
      };
    case "apikey":
      return {
        type: "apikey",
        apikey: attributes({ key: auth.key, value: auth.value, in: auth.in }),
      };
  }
}

function postmanBody(request: ApiRequest) {
  if (request.protocol === "graphql") {
    return {
      mode: "graphql",
      graphql: {
        query: request.graphql.query,
        variables: request.graphql.variables,
      },
    };
  }
  if (request.protocol !== "http") return undefined;
  const { body } = request;
  switch (body.mode) {
    case "none":
      return undefined;
    case "urlencoded":
      return { mode: "urlencoded", urlencoded: postmanPairs(body.fields) };
    case "form-data":
      return { mode: "formdata", formdata: postmanPairs(body.fields) };
    default:
      return {
        mode: "raw",
        raw: body.raw,
        options: { raw: { language: body.mode } },
      };
  }
}

function postmanRequest(request: ApiRequest) {
  const auth = postmanAuth(request.auth);
  const body = postmanBody(request);
  return {
    method: request.protocol === "http" ? request.method : "POST",
    header: postmanPairs(request.headers),
    ...(auth ? { auth } : {}),
    ...(body ? { body } : {}),
    url: postmanUrl(request.url, request.params),
    ...(request.description ? { description: request.description } : {}),
  };
}

function postmanResponses(request: ApiRequest) {
  const { auth: _auth, ...originalRequest } = postmanRequest(request);
  return request.examples.map((example) => ({
    name: example.name,
    originalRequest,
    status: HTTP_STATUS_TEXT[example.status] ?? "",
    code: example.status,
    _postman_previewlanguage: /^\s*[[{]/.test(example.body) ? "json" : "text",
    header: example.headers
      .filter((header) => header.enabled)
      .map((header) => ({ key: header.key, value: header.value })),
    cookie: [],
    body: example.body,
  }));
}

function postmanItems(
  items: CollectionItem[],
  skipped: { count: number },
): unknown[] {
  return [...items]
    .sort((a, b) => a.seq - b.seq)
    .flatMap((item): unknown[] => {
      if (item.type === "folder") {
        const auth = postmanAuth(item.auth);
        return [
          {
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
            item: postmanItems(item.items, skipped),
            ...(auth ? { auth } : {}),
          },
        ];
      }
      if (item.protocol === "websocket" || item.protocol === "socketio") {
        skipped.count += 1;
        return [];
      }
      return [
        {
          name: item.name,
          request: postmanRequest(item),
          response: postmanResponses(item),
        },
      ];
    });
}

export function postmanCollection(collection: Collection) {
  const skipped = { count: 0 };
  const auth = postmanAuth(collection.auth);
  const json = {
    info: {
      _postman_id: collection.id,
      name: collection.name,
      ...(collection.description
        ? { description: collection.description }
        : {}),
      schema: COLLECTION_SCHEMA,
    },
    item: postmanItems(collection.items, skipped),
    ...(auth ? { auth } : {}),
    ...(collection.variables.length > 0
      ? {
          variable: collection.variables.map((variable) => ({
            key: variable.key,
            value: variable.value,
            type: "string",
            ...(variable.enabled ? {} : { disabled: true }),
          })),
        }
      : {}),
  };
  return { json, skipped: skipped.count };
}

export function postmanEnvironment(environment: Environment) {
  return {
    id: environment.id,
    name: environment.name,
    values: environment.variables.map((variable) => ({
      key: variable.key,
      value: variable.secret ? "" : variable.value,
      type: variable.secret ? "secret" : "default",
      enabled: variable.enabled,
    })),
    _postman_variable_scope: "environment",
    _postman_exported_using: "Aurolis",
  };
}

function uniqueFileName(name: string, taken: Set<string>) {
  const dot = name.indexOf(".");
  let candidate = name;
  for (let n = 2; taken.has(candidate); n++) {
    candidate = `${name.slice(0, dot)}-${n}${name.slice(dot)}`;
  }
  taken.add(candidate);
  return candidate;
}

export function exportPostman(selection: ExportSelection): ExportFile {
  const taken = new Set<string>();
  let skippedRequests = 0;
  const files: Record<string, Uint8Array> = {};
  for (const collection of selection.collections) {
    const { json, skipped } = postmanCollection(collection);
    skippedRequests += skipped;
    const name = `${slugify(collection.name, "collection")}.postman_collection.json`;
    files[uniqueFileName(name, taken)] = strToU8(JSON.stringify(json, null, 2));
  }
  for (const environment of selection.environments) {
    const name = `${slugify(environment.name, "environment")}.postman_environment.json`;
    files[uniqueFileName(name, taken)] = strToU8(
      JSON.stringify(postmanEnvironment(environment), null, 2),
    );
  }
  const entries = Object.entries(files);
  if (entries.length === 1) {
    const [name, bytes] = entries[0];
    return { name, bytes, skippedRequests };
  }
  return {
    name: `${slugify(selection.workspaceName, "workspace")}.postman.zip`,
    bytes: zipSync(files),
    skippedRequests,
  };
}
