import type { CurlImport, CurlTarget } from "../types/transfer/curl.type.ts";
import type {
  HttpMethod,
  KeyValue,
  RequestAuth,
  RequestBody,
} from "../types/workspace/request.type.ts";

const MAX_NAME_LENGTH = 200;

const METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

const VALUE_FLAGS: Record<string, string> = {
  "-X": "method",
  "--request": "method",
  "-H": "header",
  "--header": "header",
  "-d": "data",
  "--data": "data",
  "--data-ascii": "data",
  "--data-binary": "data",
  "--data-raw": "data-raw",
  "--data-urlencode": "data-urlencode",
  "--json": "json",
  "-F": "form",
  "--form": "form",
  "--form-string": "form",
  "-u": "user",
  "--user": "user",
  "-A": "user-agent",
  "--user-agent": "user-agent",
  "-e": "referer",
  "--referer": "referer",
  "-b": "cookie",
  "--cookie": "cookie",
  "--url": "url",
  "-o": "skip",
  "--output": "skip",
  "-m": "skip",
  "--max-time": "skip",
  "--connect-timeout": "skip",
  "-x": "skip",
  "--proxy": "skip",
  "-c": "skip",
  "--cookie-jar": "skip",
  "-w": "skip",
  "--write-out": "skip",
  "--retry": "skip",
  "-r": "skip",
  "--range": "skip",
  "--cacert": "skip",
  "--cert": "skip",
  "--key": "skip",
  "-T": "skip",
  "--upload-file": "skip",
  "--resolve": "skip",
  "--limit-rate": "skip",
  "-K": "skip",
  "--config": "skip",
};

const SHORT_VALUE_FLAGS = new Set(
  Object.keys(VALUE_FLAGS)
    .filter((flag) => /^-[a-zA-Z]$/.test(flag))
    .map((flag) => flag[1]),
);

export class CurlParseError extends Error {}

export function looksLikeCurl(text: string) {
  return /^\s*curl(\.exe)?\s/i.test(text);
}

function joinContinuations(text: string) {
  return text
    .replace(/\\\r?\n/g, " ")
    .replace(/\^\r?\n/g, " ")
    .replace(/`\r?\n/g, " ");
}

function ansiC(text: string) {
  return text.replace(/\\(n|t|r|'|"|\\)/g, (_, char: string) => {
    if (char === "n") return "\n";
    if (char === "t") return "\t";
    if (char === "r") return "\r";
    return char;
  });
}

export function tokenize(input: string): string[] {
  const text = joinContinuations(input);
  const tokens: string[] = [];
  let current = "";
  let started = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      if (started) tokens.push(current);
      current = "";
      started = false;
      index += 1;
      continue;
    }
    started = true;
    if (char === "$" && text[index + 1] === "'") {
      const end = findClosing(text, index + 2, "'", true);
      current += ansiC(text.slice(index + 2, end));
      index = end + 1;
    } else if (char === "'") {
      const end = text.indexOf("'", index + 1);
      if (end === -1) throw new CurlParseError("A quote isn't closed.");
      current += text.slice(index + 1, end);
      index = end + 1;
    } else if (char === '"') {
      const end = findClosing(text, index + 1, '"', true);
      current += text
        .slice(index + 1, end)
        .replace(/\\(["\\$`])/g, "$1")
        .replace(/\\\n/g, "");
      index = end + 1;
    } else if (char === "\\" && index + 1 < text.length) {
      current += text[index + 1];
      index += 2;
    } else {
      current += char;
      index += 1;
    }
  }
  if (started) tokens.push(current);
  return tokens;
}

function findClosing(
  text: string,
  from: number,
  quote: string,
  escapes: boolean,
) {
  let index = from;
  while (index < text.length) {
    if (escapes && text[index] === "\\") {
      index += 2;
      continue;
    }
    if (text[index] === quote) return index;
    index += 1;
  }
  throw new CurlParseError("A quote isn't closed.");
}

type Parsed = {
  method: string | null;
  url: string | null;
  headers: [string, string][];
  data: string[];
  urlencoded: string[];
  form: [string, string][];
  json: boolean;
  user: string | null;
  get: boolean;
  head: boolean;
};

function readFlags(tokens: string[]): Parsed {
  const parsed: Parsed = {
    method: null,
    url: null,
    headers: [],
    data: [],
    urlencoded: [],
    form: [],
    json: false,
    user: null,
    get: false,
    head: false,
  };
  const apply = (kind: string, value: string) => {
    switch (kind) {
      case "method":
        parsed.method = value.toUpperCase();
        break;
      case "header": {
        const colon = value.indexOf(":");
        if (colon > 0) {
          parsed.headers.push([
            value.slice(0, colon).trim(),
            value.slice(colon + 1).trim(),
          ]);
        }
        break;
      }
      case "data":
      case "data-raw":
        parsed.data.push(value);
        break;
      case "data-urlencode":
        parsed.urlencoded.push(value);
        break;
      case "json":
        parsed.json = true;
        parsed.data.push(value);
        break;
      case "form": {
        const equals = value.indexOf("=");
        if (equals > 0) {
          parsed.form.push([value.slice(0, equals), value.slice(equals + 1)]);
        }
        break;
      }
      case "user":
        parsed.user = value;
        break;
      case "user-agent":
        parsed.headers.push(["User-Agent", value]);
        break;
      case "referer":
        parsed.headers.push(["Referer", value]);
        break;
      case "cookie":
        parsed.headers.push(["Cookie", value]);
        break;
      case "url":
        parsed.url = value;
        break;
      default:
        break;
    }
  };

  let index = /^curl(\.exe)?$/i.test(tokens[0] ?? "") ? 1 : 0;
  while (index < tokens.length) {
    const token = tokens[index];
    index += 1;
    if (token.startsWith("--")) {
      const [flag, inline] = token.includes("=")
        ? [
            token.slice(0, token.indexOf("=")),
            token.slice(token.indexOf("=") + 1),
          ]
        : [token, null];
      if (flag === "--get") parsed.get = true;
      else if (flag === "--head") parsed.head = true;
      const kind = VALUE_FLAGS[flag];
      if (kind) {
        const value = inline ?? tokens[index];
        if (inline === null) index += 1;
        if (value !== undefined) apply(kind, value);
      }
      continue;
    }
    if (token.startsWith("-") && token.length > 1) {
      for (let position = 1; position < token.length; position += 1) {
        const letter = token[position];
        if (letter === "G") parsed.get = true;
        if (letter === "I") parsed.head = true;
        if (SHORT_VALUE_FLAGS.has(letter)) {
          const rest = token.slice(position + 1);
          const value = rest || tokens[index];
          if (!rest) index += 1;
          if (value !== undefined) apply(VALUE_FLAGS[`-${letter}`], value);
          break;
        }
      }
      continue;
    }
    parsed.url ??= token;
  }
  return parsed;
}

function headerValue(headers: [string, string][], name: string) {
  const lower = name.toLowerCase();
  return headers.find(([key]) => key.toLowerCase() === lower)?.[1] ?? null;
}

function withoutHeader(headers: [string, string][], name: string) {
  const lower = name.toLowerCase();
  return headers.filter(([key]) => key.toLowerCase() !== lower);
}

function decodeBase64(text: string) {
  try {
    const binary = atob(text.trim());
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function basicAuth(credentials: string): RequestAuth {
  const colon = credentials.indexOf(":");
  return colon === -1
    ? { type: "basic", username: credentials, password: "" }
    : {
        type: "basic",
        username: credentials.slice(0, colon),
        password: credentials.slice(colon + 1),
      };
}

function authFromHeaders(headers: [string, string][]) {
  const value = headerValue(headers, "authorization");
  if (!value) return { auth: null, headers };
  const bearer = /^Bearer\s+(.+)$/i.exec(value);
  if (bearer) {
    return {
      auth: { type: "bearer", token: bearer[1].trim() } as RequestAuth,
      headers: withoutHeader(headers, "authorization"),
    };
  }
  const basic = /^Basic\s+(.+)$/i.exec(value);
  const decoded = basic ? decodeBase64(basic[1]) : null;
  if (decoded !== null) {
    return {
      auth: basicAuth(decoded),
      headers: withoutHeader(headers, "authorization"),
    };
  }
  return { auth: null, headers };
}

function decodeComponent(text: string) {
  try {
    return decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    return text;
  }
}

function pairsFromQuery(query: string): KeyValue[] {
  return query
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const equals = part.indexOf("=");
      const key = equals === -1 ? part : part.slice(0, equals);
      const value = equals === -1 ? "" : part.slice(equals + 1);
      return {
        key: decodeComponent(key),
        value: decodeComponent(value),
        enabled: true,
      };
    });
}

function splitUrl(url: string) {
  const hash = url.indexOf("#");
  const withoutHash = hash === -1 ? url : url.slice(0, hash);
  const question = withoutHash.indexOf("?");
  if (question === -1) return { base: withoutHash, params: [] as KeyValue[] };
  return {
    base: withoutHash.slice(0, question),
    params: pairsFromQuery(withoutHash.slice(question + 1)),
  };
}

function urlencodedPair(entry: string): KeyValue {
  const equals = entry.indexOf("=");
  if (equals === -1) return { key: entry, value: "", enabled: true };
  return {
    key: entry.slice(0, equals),
    value: entry.slice(equals + 1),
    enabled: true,
  };
}

function isJson(text: string) {
  const trimmed = text.trim();
  if (!/^[[{]/.test(trimmed)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function prettyJson(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function bodyFrom(parsed: Parsed, contentType: string | null): RequestBody {
  if (parsed.form.length > 0) {
    return {
      mode: "form-data",
      fields: parsed.form.map(([key, value]) => ({
        key,
        value,
        enabled: true,
      })),
    };
  }
  if (parsed.urlencoded.length > 0 && parsed.data.length === 0) {
    return {
      mode: "urlencoded",
      fields: parsed.urlencoded.map(urlencodedPair),
    };
  }
  if (parsed.data.length === 0) return { mode: "none" };
  const raw = parsed.data.join("&");
  const type = (contentType ?? "").toLowerCase();
  if (parsed.json || type.includes("json") || (!type && isJson(raw))) {
    return { mode: "json", raw: prettyJson(raw) };
  }
  if (type.includes("xml")) return { mode: "xml", raw };
  if (
    type.includes("x-www-form-urlencoded") ||
    (!type && /^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(raw))
  ) {
    return { mode: "urlencoded", fields: pairsFromQuery(raw) };
  }
  return { mode: "text", raw };
}

function redundantContentType(body: RequestBody, contentType: string | null) {
  if (!contentType) return false;
  const type = contentType.toLowerCase().split(";")[0].trim();
  if (body.mode === "form-data" || body.mode === "urlencoded") return true;
  return (
    (body.mode === "json" && type === "application/json") ||
    (body.mode === "xml" && type === "application/xml") ||
    (body.mode === "text" && type === "text/plain")
  );
}

export function parseCurl(text: string): CurlImport {
  if (!looksLikeCurl(text)) {
    throw new CurlParseError("Paste a command that starts with curl.");
  }
  const parsed = readFlags(tokenize(text.trim()));
  if (!parsed.url) throw new CurlParseError("The command has no URL.");

  let headers = parsed.headers;
  if (parsed.json) {
    if (!headerValue(headers, "content-type")) {
      headers.push(["Content-Type", "application/json"]);
    }
    if (!headerValue(headers, "accept")) {
      headers.push(["Accept", "application/json"]);
    }
  }
  const fromHeaders = authFromHeaders(headers);
  headers = fromHeaders.headers;
  const auth = parsed.user ? basicAuth(parsed.user) : fromHeaders.auth;

  const { base, params } = splitUrl(parsed.url);
  const queryData = parsed.get
    ? [...parsed.data, ...parsed.urlencoded].flatMap(pairsFromQuery)
    : [];
  if (parsed.get) {
    parsed.data = [];
    parsed.urlencoded = [];
  }

  const contentType = headerValue(headers, "content-type");
  const body = bodyFrom(parsed, contentType);
  if (redundantContentType(body, contentType)) {
    headers = withoutHeader(headers, "content-type");
  }

  const explicit = parsed.method as HttpMethod | null;
  const method: HttpMethod =
    explicit && METHODS.includes(explicit)
      ? explicit
      : parsed.head
        ? "HEAD"
        : body.mode !== "none"
          ? "POST"
          : "GET";

  return {
    method,
    url: base,
    params: [...params, ...queryData],
    headers: headers.map(([key, value]) => ({ key, value, enabled: true })),
    body,
    auth,
  };
}

function quote(value: string) {
  if (/^[\w@%+=:,./-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function toCurl(target: CurlTarget): string {
  const parts: string[] = [];
  const hasBody = target.body.kind !== "none";
  if (target.method === "HEAD") parts.push("--head");
  else if (target.method !== "GET" || hasBody) {
    parts.push(`--request ${target.method}`);
  }
  parts.push(`--url ${quote(target.url)}`);
  for (const [key, value] of target.headers) {
    parts.push(`--header ${quote(`${key}: ${value}`)}`);
  }
  switch (target.body.kind) {
    case "text":
      parts.push(`--data-raw ${quote(target.body.text)}`);
      break;
    case "urlencoded":
      for (const [key, value] of target.body.fields) {
        parts.push(`--data-urlencode ${quote(`${key}=${value}`)}`);
      }
      break;
    case "form-data":
      for (const [key, value] of target.body.fields) {
        parts.push(`--form-string ${quote(`${key}=${value}`)}`);
      }
      break;
    default:
      break;
  }
  return `curl ${parts.join(" \\\n  ")}`;
}

export function curlRequestName(curl: CurlImport) {
  const path = curl.url
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "")
    .replace(/\/+$/, "");
  return `${curl.method} ${path || "/"}`.slice(0, MAX_NAME_LENGTH);
}
