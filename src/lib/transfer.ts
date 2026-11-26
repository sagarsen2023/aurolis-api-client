import type {
  Collection,
  CollectionItem,
} from "../types/workspace/collection.type.ts";
import type {
  ApiRequest,
  HttpMethod,
  KeyValue,
  RequestAuth,
  RequestBody,
} from "../types/workspace/request.type.ts";
import type {
  CredentialSummary,
  ImportBundle,
  ImportNote,
  ImportNotes,
} from "../types/transfer/transfer.type.ts";
import { seqBetween } from "./workspace-format.ts";

const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];
const MAX_NAME_LENGTH = 200;
const ANGLE_VARIABLE = /<<\s*([A-Za-z_][\w.-]*)\s*>>/g;
const CURLY_VARIABLE = /\{\{\s*([^{}\s]+)\s*\}\}/g;
const VARIABLE_ONLY = /^\s*\{\{\s*[^{}\s]+\s*\}\}\s*$/;
const CREDENTIAL_HEADER =
  /^(authorization|proxy-authorization|cookie|x-?api-?key|api-?key|.*(token|secret|password).*)$/i;
const CREDENTIAL_VARIABLE = /(token|secret|password|api[-_]?key)/i;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const HAS_JWT = new RegExp(JWT.source);

export const newId = () => crypto.randomUUID();

export const sequence = (index: number) => seqBetween() * (index + 1);

export function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function itemName(value: unknown, fallback: string) {
  return text(value).trim().slice(0, MAX_NAME_LENGTH) || fallback;
}

export function exampleStatus(code: unknown) {
  const status = Number(code);
  return Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : 200;
}

export function addNote(notes: ImportNotes, note: ImportNote, count = 1) {
  if (count > 0) notes[note] = (notes[note] ?? 0) + count;
}

export function toHttpMethod(value: unknown, notes: ImportNotes): HttpMethod {
  const method = text(value).trim().toUpperCase();
  if (!method) return "GET";
  if (HTTP_METHODS.includes(method as HttpMethod)) return method as HttpMethod;
  addNote(notes, "unsupported-method");
  return "GET";
}

export const fromAngleVariables = (value: string) =>
  value.replace(ANGLE_VARIABLE, "{{$1}}");

export const toAngleVariables = (value: string) =>
  value.replace(CURLY_VARIABLE, "<<$1>>");

function mapPairs(pairs: KeyValue[], map: (value: string) => string) {
  return pairs.map((pair) => ({
    ...pair,
    key: map(pair.key),
    value: map(pair.value),
  }));
}

export function mapAuthText(
  auth: RequestAuth,
  map: (value: string) => string,
): RequestAuth {
  switch (auth.type) {
    case "bearer":
      return { ...auth, token: map(auth.token) };
    case "basic":
      return {
        ...auth,
        username: map(auth.username),
        password: map(auth.password),
      };
    case "apikey":
      return { ...auth, key: map(auth.key), value: map(auth.value) };
    default:
      return auth;
  }
}

function mapBodyText(
  body: RequestBody,
  map: (value: string) => string,
): RequestBody {
  switch (body.mode) {
    case "none":
      return body;
    case "urlencoded":
    case "form-data":
      return { ...body, fields: mapPairs(body.fields, map) };
    default:
      return { ...body, raw: map(body.raw) };
  }
}

export function mapRequestText(
  request: ApiRequest,
  map: (value: string) => string,
): ApiRequest {
  const base = {
    ...request,
    url: map(request.url),
    params: mapPairs(request.params, map),
    headers: mapPairs(request.headers, map),
    auth: mapAuthText(request.auth, map),
  };
  switch (base.protocol) {
    case "http":
      return { ...base, body: mapBodyText(base.body, map) };
    case "graphql":
      return {
        ...base,
        graphql: {
          ...base.graphql,
          query: map(base.graphql.query),
          variables: map(base.graphql.variables),
        },
      };
    default:
      return base;
  }
}

const isLiteral = (value: string) =>
  value.trim() !== "" && !VARIABLE_ONLY.test(value);

function variableNameFor(header: string) {
  const words = header.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word[0].toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}

type CredentialVisitor = {
  auth: (auth: RequestAuth) => RequestAuth;
  header: (header: KeyValue) => KeyValue;
  text: (value: string) => string;
};

function visitAuth(
  auth: RequestAuth,
  found: (variable: string) => string,
): RequestAuth {
  if (auth.type === "bearer" && isLiteral(auth.token)) {
    return { ...auth, token: found("token") };
  }
  if (auth.type === "basic" && isLiteral(auth.password)) {
    return { ...auth, password: found("password") };
  }
  if (auth.type === "apikey" && isLiteral(auth.value)) {
    return { ...auth, value: found("apiKey") };
  }
  return auth;
}

function visitHeader(
  header: KeyValue,
  found: (variable: string) => string,
): KeyValue {
  if (!CREDENTIAL_HEADER.test(header.key.trim()) || !isLiteral(header.value)) {
    return header;
  }
  const bearer = /^bearer\s+/i.exec(header.value);
  if (bearer && isLiteral(header.value.slice(bearer[0].length))) {
    return { ...header, value: `${bearer[0]}${found("token")}` };
  }
  return { ...header, value: found(variableNameFor(header.key)) };
}

function visitItems(
  items: CollectionItem[],
  visitor: CredentialVisitor,
): CollectionItem[] {
  return items.map((item) => {
    if (item.type === "folder") {
      return {
        ...item,
        auth: visitor.auth(item.auth),
        items: visitItems(item.items, visitor),
      };
    }
    const request = mapRequestText(
      {
        ...item,
        auth: visitor.auth(item.auth),
        headers: item.headers.map(visitor.header),
      },
      visitor.text,
    );
    return {
      ...request,
      examples: request.examples.map((example) => ({
        ...example,
        headers: mapPairs(example.headers, visitor.text),
        body: visitor.text(example.body),
      })),
    };
  });
}

function credentialVariables(collection: Collection) {
  return collection.variables.filter(
    (variable) =>
      isLiteral(variable.value) &&
      (CREDENTIAL_VARIABLE.test(variable.key) || HAS_JWT.test(variable.value)),
  );
}

function walkCredentials(bundle: ImportBundle) {
  const variables = new Set<string>();
  let tokens = 0;
  let headers = 0;
  const reference = (variable: string) => {
    variables.add(variable);
    return `{{${variable}}}`;
  };
  const visitor: CredentialVisitor = {
    auth: (auth) => {
      const next = visitAuth(auth, reference);
      if (next !== auth) tokens += 1;
      return next;
    },
    header: (header) => {
      const next = visitHeader(header, reference);
      if (next !== header) headers += 1;
      return next;
    },
    text: (value) =>
      value.replace(JWT, () => {
        tokens += 1;
        return reference("token");
      }),
  };
  const collections = bundle.collections.map((collection) => {
    const moved = credentialVariables(collection);
    for (const variable of moved) variables.add(variable.key.trim());
    tokens += moved.length;
    return {
      ...collection,
      auth: visitor.auth(collection.auth),
      variables: collection.variables.filter(
        (variable) => !moved.includes(variable),
      ),
      items: visitItems(collection.items, visitor),
    };
  });
  return {
    bundle: { ...bundle, collections },
    summary: { tokens, headers, variables: [...variables] },
  };
}

export function summarizeCredentials(bundle: ImportBundle): CredentialSummary {
  return walkCredentials(bundle).summary;
}

export function replaceCredentials(bundle: ImportBundle) {
  return walkCredentials(bundle);
}

export function mergeBundles(bundles: ImportBundle[]): ImportBundle {
  const notes: ImportNotes = {};
  for (const bundle of bundles) {
    for (const [note, count] of Object.entries(bundle.notes)) {
      addNote(notes, note as ImportNote, count);
    }
  }
  return {
    collections: bundles.flatMap((bundle) => bundle.collections),
    environments: bundles.flatMap((bundle) => bundle.environments),
    notes,
  };
}
