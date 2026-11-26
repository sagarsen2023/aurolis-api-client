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
  toAngleVariables,
  toHttpMethod,
} from "@/lib/transfer";
import { slugify } from "@/lib/workspace-format";
import type {
  ExportFile,
  ExportSelection,
  ImportBundle,
  ImportedEnvironment,
  ImportNotes,
  ImportSource,
} from "@/types/transfer/transfer.type";
import type {
  Collection,
  CollectionItem,
  Folder,
} from "@/types/workspace/collection.type";
import type { Environment } from "@/types/workspace/environment.type";
import type {
  ApiRequest,
  GraphqlRequest,
  HttpRequest,
  KeyValue,
  RequestAuth,
  RequestBody,
  RequestExample,
} from "@/types/workspace/request.type";

const COLLECTION_VERSION = 12;
const REST_REQUEST_VERSION = "17";
const GRAPHQL_REQUEST_VERSION = 10;
const ORIGINAL_REQUEST_VERSION = "6";
const ENVIRONMENT_VERSION = 2;
const JSON_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "application/hal+json",
  "application/vnd.api+json",
]);
const XML_TYPES = new Set(["application/xml", "text/xml"]);
const TEXT_TYPES = new Set(["text/plain", "text/html"]);
const RAW_KEY_VALUE_SPECIAL = /[#:\n"]/;

type Json = Record<string, unknown>;

const record = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

function parseJson(name: string, content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`${name} isn't valid JSON.`);
  }
}

function collectionProperties(node: Json) {
  const data =
    typeof node.data === "string"
      ? record(parseJson("Collection data", node.data))
      : record(node.data);
  return {
    auth: node.auth ?? data.auth,
    headers: node.headers ?? data.headers,
    variables: node.variables ?? data.variables,
    description: node.description ?? data.description,
  };
}

function readPairs(value: unknown): KeyValue[] {
  return list(value)
    .map(record)
    .filter((pair) => text(pair.key) || text(pair.value))
    .map((pair) => ({
      key: text(pair.key),
      value: text(pair.value),
      enabled: pair.active !== false,
    }));
}

function readVariables(value: unknown): KeyValue[] {
  return list(value)
    .map(record)
    .filter((variable) => text(variable.key))
    .map((variable) => ({
      key: text(variable.key),
      value:
        text(variable.currentValue) ||
        text(variable.initialValue) ||
        text(variable.value),
      enabled: true,
    }));
}

function readAuth(
  value: unknown,
  absent: RequestAuth,
  notes: ImportNotes,
): RequestAuth {
  const auth = record(value);
  if (!auth.authType) return absent;
  if (auth.authActive === false) return { type: "none" };
  switch (auth.authType) {
    case "none":
      return { type: "none" };
    case "inherit":
      return absent;
    case "bearer":
      return { type: "bearer", token: text(auth.token) };
    case "basic":
      return {
        type: "basic",
        username: text(auth.username),
        password: text(auth.password),
      };
    case "api-key":
      return {
        type: "apikey",
        key: text(auth.key),
        value: text(auth.value),
        in: auth.addTo === "QUERY_PARAMS" ? "query" : "header",
      };
    default:
      addNote(notes, "unsupported-auth");
      return { type: "none" };
  }
}

function unquote(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"')) return trimmed;
  try {
    return String(JSON.parse(trimmed));
  } catch {
    return trimmed;
  }
}

function readRawKeyValues(raw: string): KeyValue[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const disabled = line.startsWith("#");
      const entry = disabled ? line.slice(1) : line;
      const colon = entry.indexOf(":");
      return {
        key: unquote(colon === -1 ? entry : entry.slice(0, colon)),
        value: colon === -1 ? "" : unquote(entry.slice(colon + 1)),
        enabled: !disabled,
      };
    })
    .filter((pair) => pair.key);
}

function readFormFields(value: unknown, notes: ImportNotes): KeyValue[] {
  const fields = list(value).map(record);
  addNote(
    notes,
    "file-fields",
    fields.filter((field) => field.isFile === true).length,
  );
  return fields
    .filter((field) => field.isFile !== true && text(field.key))
    .map((field) => ({
      key: text(field.key),
      value: text(field.value),
      enabled: field.active !== false,
    }));
}

function readBody(value: unknown, notes: ImportNotes): RequestBody {
  const body = record(value);
  const contentType = text(body.contentType);
  if (!contentType) return { mode: "none" };
  if (contentType === "multipart/form-data") {
    return { mode: "form-data", fields: readFormFields(body.body, notes) };
  }
  if (contentType === "application/x-www-form-urlencoded") {
    return { mode: "urlencoded", fields: readRawKeyValues(text(body.body)) };
  }
  const raw = text(body.body);
  if (JSON_TYPES.has(contentType))
    return raw ? { mode: "json", raw } : { mode: "none" };
  if (XML_TYPES.has(contentType))
    return raw ? { mode: "xml", raw } : { mode: "none" };
  if (TEXT_TYPES.has(contentType))
    return raw ? { mode: "text", raw } : { mode: "none" };
  addNote(notes, "unsupported-body");
  return { mode: "none" };
}

function readExamples(value: unknown): RequestExample[] {
  return Object.entries(record(value)).map(([key, response], index) => {
    const example = record(response);
    return {
      id: newId(),
      name: itemName(example.name || key, `Example ${index + 1}`),
      seq: sequence(index),
      status: exampleStatus(example.code),
      headers: readPairs(example.headers),
      body: text(example.body),
    };
  });
}

function withInherited(inherited: KeyValue[], own: KeyValue[]) {
  const ownKeys = new Set(own.map((header) => header.key.toLowerCase()));
  return [
    ...inherited.filter((header) => !ownKeys.has(header.key.toLowerCase())),
    ...own,
  ];
}

function hasScripts(request: Json) {
  return [request.preRequestScript, request.testScript].some((script) =>
    text(script).trim(),
  );
}

function isGraphql(request: Json) {
  return "query" in request && "url" in request && !("endpoint" in request);
}

function readRequest(
  request: Json,
  index: number,
  inherited: KeyValue[],
  notes: ImportNotes,
): ApiRequest {
  if (hasScripts(request)) addNote(notes, "scripts");
  if (list(request.requestVariables).length > 0) {
    addNote(notes, "request-variables");
  }
  const shared = {
    type: "request" as const,
    id: newId(),
    name: itemName(request.name, "Untitled request"),
    seq: sequence(index),
    description: text(request.description),
    params: readPairs(request.params),
    headers: withInherited(inherited, readPairs(request.headers)),
    auth: readAuth(request.auth, { type: "inherit" }, notes),
    examples: readExamples(request.responses),
  };
  const imported: ApiRequest = isGraphql(request)
    ? {
        ...shared,
        protocol: "graphql",
        url: text(request.url),
        graphql: {
          query: text(request.query),
          variables: text(request.variables),
          operationName: "",
        },
      }
    : {
        ...shared,
        protocol: "http",
        url:
          text(request.endpoint) || `${text(request.url)}${text(request.path)}`,
        method: toHttpMethod(request.method, notes),
        body: readBody(request.body, notes),
      };
  return mapRequestText(imported, fromAngleVariables);
}

function readChildren(
  node: Json,
  inherited: KeyValue[],
  notes: ImportNotes,
): CollectionItem[] {
  const folders = list(node.folders).map(record);
  const requests = list(node.requests).map(record);
  return [
    ...folders.map((folder, index) =>
      readFolder(folder, index, inherited, notes),
    ),
    ...requests.map((request, index) =>
      readRequest(request, folders.length + index, inherited, notes),
    ),
  ];
}

function ownHeaders(headers: unknown, notes: ImportNotes) {
  const active = readPairs(headers).filter((header) => header.enabled);
  addNote(notes, "inherited-headers", active.length);
  return active;
}

function readFolder(
  node: Json,
  index: number,
  inherited: KeyValue[],
  notes: ImportNotes,
): Folder {
  const properties = collectionProperties(node);
  if (readVariables(properties.variables).length > 0) {
    addNote(notes, "folder-variables");
  }
  if (hasScripts(node)) addNote(notes, "scripts");
  const headers = withInherited(
    inherited,
    ownHeaders(properties.headers, notes),
  );
  return {
    type: "folder",
    id: newId(),
    name: itemName(node.name, "Untitled folder"),
    seq: sequence(index),
    description: text(properties.description),
    auth: mapAuthText(
      readAuth(properties.auth, { type: "inherit" }, notes),
      fromAngleVariables,
    ),
    items: readChildren(node, headers, notes),
  };
}

function readCollection(node: Json, notes: ImportNotes): Collection {
  const properties = collectionProperties(node);
  if (hasScripts(node)) addNote(notes, "scripts");
  return {
    id: newId(),
    name: itemName(node.name, "Imported collection"),
    seq: sequence(0),
    description: text(properties.description),
    auth: mapAuthText(
      readAuth(properties.auth, { type: "none" }, notes),
      fromAngleVariables,
    ),
    variables: readVariables(properties.variables),
    items: readChildren(node, ownHeaders(properties.headers, notes), notes),
  };
}

function readEnvironment(node: Json): ImportedEnvironment {
  return {
    name: itemName(node.name, "Imported environment"),
    variables: list(node.variables)
      .map(record)
      .filter((variable) => text(variable.key))
      .map((variable) => ({
        key: text(variable.key),
        value:
          text(variable.currentValue) ||
          text(variable.initialValue) ||
          text(variable.value),
        enabled: true,
        secret: variable.secret === true,
      })),
  };
}

function readEntries(name: string, content: string): ImportBundle {
  const parsed = parseJson(name, content);
  const entries = (Array.isArray(parsed) ? parsed : [parsed]).map(record);
  const notes: ImportNotes = {};
  const bundle: ImportBundle = { collections: [], environments: [], notes };
  for (const entry of entries) {
    if (Array.isArray(entry.folders) || Array.isArray(entry.requests)) {
      bundle.collections.push(readCollection(entry, notes));
    } else if (Array.isArray(entry.variables)) {
      bundle.environments.push(readEnvironment(entry));
    }
  }
  if (bundle.collections.length + bundle.environments.length === 0) {
    throw new Error(
      `${name} isn't a Hoppscotch collection or environment export.`,
    );
  }
  return bundle;
}

function readWorkspaceZip(source: ImportSource): ImportBundle[] {
  const files = unzipSync(source.bytes, {
    filter: (file) =>
      file.name.endsWith("/collections.json") ||
      file.name.endsWith("/environments.json") ||
      file.name === "collections.json" ||
      file.name === "environments.json",
  });
  const bundles = Object.entries(files)
    .map(([name, bytes]) => ({ name, content: strFromU8(bytes) }))
    .filter((file) => file.content.trim())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file) => readEntries(file.name, file.content));
  if (bundles.length === 0) {
    throw new Error(
      `${source.name} has no Hoppscotch collections or environments in it.`,
    );
  }
  return bundles;
}

export function importHoppscotch(sources: ImportSource[]): ImportBundle {
  return mergeBundles(
    sources.flatMap((source) =>
      isZip(source.bytes)
        ? readWorkspaceZip(source)
        : [readEntries(source.name, strFromU8(source.bytes))],
    ),
  );
}

function hoppAuth(auth: RequestAuth) {
  switch (auth.type) {
    case "inherit":
    case "none":
      return { authType: auth.type, authActive: true };
    case "bearer":
      return { authType: "bearer", authActive: true, token: auth.token };
    case "basic":
      return {
        authType: "basic",
        authActive: true,
        username: auth.username,
        password: auth.password,
      };
    case "apikey":
      return {
        authType: "api-key",
        authActive: true,
        key: auth.key,
        value: auth.value,
        addTo: auth.in === "query" ? "QUERY_PARAMS" : "HEADERS",
      };
  }
}

function hoppPairs(pairs: KeyValue[]) {
  return pairs
    .filter((pair) => pair.key || pair.value)
    .map((pair) => ({
      key: pair.key,
      value: pair.value,
      active: pair.enabled,
      description: "",
    }));
}

function rawKeyValue(value: string) {
  return RAW_KEY_VALUE_SPECIAL.test(value) ? JSON.stringify(value) : value;
}

function hoppBody(body: RequestBody) {
  switch (body.mode) {
    case "none":
      return { contentType: null, body: null };
    case "json":
      return { contentType: "application/json", body: body.raw };
    case "xml":
      return { contentType: "application/xml", body: body.raw };
    case "text":
      return { contentType: "text/plain", body: body.raw };
    case "urlencoded":
      return {
        contentType: "application/x-www-form-urlencoded",
        body: body.fields
          .filter((field) => field.key)
          .map(
            (field) =>
              `${field.enabled ? "" : "#"}${rawKeyValue(field.key)}: ${rawKeyValue(field.value)}`,
          )
          .join("\n"),
        isBulkEditing: false,
      };
    case "form-data":
      return {
        contentType: "multipart/form-data",
        body: body.fields
          .filter((field) => field.key)
          .map((field) => ({
            key: field.key,
            value: field.value,
            active: field.enabled,
            isFile: false,
          })),
        isBulkEditing: false,
        showIndividualContentType: false,
      };
  }
}

function uniqueName(name: string, taken: Set<string>) {
  let candidate = name;
  for (let n = 2; taken.has(candidate); n++) candidate = `${name} (${n})`;
  taken.add(candidate);
  return candidate;
}

function hoppResponses(request: HttpRequest) {
  const originalRequest = {
    v: ORIGINAL_REQUEST_VERSION,
    name: request.name,
    method: request.method,
    endpoint: request.url,
    headers: hoppPairs(request.headers),
    params: hoppPairs(request.params),
    body: hoppBody(request.body),
    auth: hoppAuth(request.auth),
    requestVariables: [],
  };
  const taken = new Set<string>();
  return Object.fromEntries(
    request.examples.map((example) => {
      const name = uniqueName(example.name, taken);
      return [
        name,
        {
          name,
          status: HTTP_STATUS_TEXT[example.status] ?? "",
          code: example.status,
          headers: example.headers
            .filter((header) => header.enabled)
            .map((header) => ({ key: header.key, value: header.value })),
          body: example.body,
          originalRequest,
        },
      ];
    }),
  );
}

function hoppRestRequest(request: HttpRequest) {
  return {
    v: REST_REQUEST_VERSION,
    id: request.id,
    _ref_id: `req_${request.id}`,
    name: request.name,
    method: request.method,
    endpoint: request.url,
    params: hoppPairs(request.params),
    headers: hoppPairs(request.headers),
    auth: hoppAuth(request.auth),
    body: hoppBody(request.body),
    preRequestScript: "",
    testScript: "",
    requestVariables: [],
    responses: hoppResponses(request),
    description: request.description || null,
  };
}

function hoppGraphqlRequest(request: GraphqlRequest) {
  return {
    v: GRAPHQL_REQUEST_VERSION,
    id: request.id,
    _ref_id: `req_${request.id}`,
    name: request.name,
    url: request.url,
    headers: hoppPairs(request.headers),
    query: request.graphql.query,
    variables: request.graphql.variables,
    auth: hoppAuth(request.auth),
    preRequestScript: "",
    testScript: "",
    responses: {},
    description: request.description || null,
  };
}

function hoppRequest(request: ApiRequest) {
  const converted = mapRequestText(request, toAngleVariables);
  switch (converted.protocol) {
    case "http":
      return hoppRestRequest(converted);
    case "graphql":
      return hoppGraphqlRequest(converted);
    default:
      return null;
  }
}

type HoppNode = Collection | Folder;

function hoppCollection(
  node: HoppNode,
  isRoot: boolean,
  skipped: { count: number },
): Json {
  const items = [...node.items].sort((a, b) => a.seq - b.seq);
  const requests = items
    .filter((item): item is ApiRequest => item.type === "request")
    .map((request) => {
      const converted = hoppRequest(request);
      if (!converted) skipped.count += 1;
      return converted;
    })
    .filter((request) => request !== null);
  const properties = {
    auth: hoppAuth(mapAuthText(node.auth, toAngleVariables)),
    headers: [],
    variables:
      isRoot && "variables" in node
        ? node.variables.map((variable) => ({
            key: variable.key,
            initialValue: variable.value,
            currentValue: variable.value,
            secret: false,
          }))
        : [],
    description: node.description || null,
  };
  return {
    id: node.id,
    name: node.name,
    folders: items
      .filter((item): item is Folder => item.type === "folder")
      .map((folder) => hoppCollection(folder, false, skipped)),
    requests,
    data: JSON.stringify(properties),
    v: COLLECTION_VERSION,
    _ref_id: `coll_${node.id}`,
    ...properties,
    preRequestScript: "",
    testScript: "",
  };
}

function hoppEnvironment(environment: Environment) {
  return {
    v: ENVIRONMENT_VERSION,
    id: environment.id,
    name: environment.name,
    variables: environment.variables.map((variable) => {
      const value = variable.secret ? "" : variable.value;
      return {
        key: variable.key,
        secret: variable.secret,
        currentValue: value,
        initialValue: value,
      };
    }),
  };
}

export function exportHoppscotch(selection: ExportSelection): ExportFile {
  const skipped = { count: 0 };
  const collections = selection.collections.map((collection) =>
    hoppCollection(collection, true, skipped),
  );
  const environments = selection.environments.map(hoppEnvironment);
  const folder = `workspaces/${slugify(selection.workspaceName, "workspace")}-${selection.workspaceId}`;
  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: null,
    workspaces: [
      {
        id: selection.workspaceId,
        name: selection.workspaceName,
        folder,
        collections: collections.length,
        environments: environments.length,
        members: 0,
      },
    ],
  };
  const json = (value: unknown) => strToU8(JSON.stringify(value, null, 2));
  return {
    name: `hoppscotch-${slugify(selection.workspaceName, "workspace")}-${new Date().toISOString().slice(0, 10)}.zip`,
    bytes: zipSync({
      "manifest.json": json(manifest),
      [`${folder}/members.json`]: json([]),
      [`${folder}/environments.json`]: json(environments),
      [`${folder}/collections.json`]: json(collections),
    }),
    skippedRequests: skipped.count,
  };
}
