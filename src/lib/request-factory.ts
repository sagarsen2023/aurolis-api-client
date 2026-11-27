import type { CurlImport } from "../types/transfer/curl.type.ts";
import type {
  ApiRequest,
  HttpRequest,
  RequestProtocol,
} from "../types/workspace/request.type.ts";

const SOCKETIO_DEFAULT_PATH = "/socket.io";

type RequestIdentity = { id: string; name: string; seq: number };

export function createRequest(
  protocol: RequestProtocol,
  identity: RequestIdentity,
): ApiRequest {
  const base = {
    type: "request" as const,
    ...identity,
    description: "",
    url: "",
    params: [],
    headers: [],
    auth: { type: "inherit" as const },
    examples: [],
  };
  switch (protocol) {
    case "graphql":
      return {
        ...base,
        protocol,
        graphql: { query: "", variables: "", operationName: "" },
      };
    case "websocket":
      return { ...base, protocol, messages: [] };
    case "socketio":
      return {
        ...base,
        protocol,
        messages: [],
        socketio: { path: SOCKETIO_DEFAULT_PATH, events: [] },
      };
    default:
      return {
        ...base,
        protocol: "http",
        method: "GET",
        body: { mode: "none" },
      };
  }
}

export function supportsExamples(protocol: RequestProtocol) {
  return protocol === "http" || protocol === "graphql";
}

export function withCurl<
  T extends Pick<
    HttpRequest,
    "method" | "url" | "params" | "headers" | "body" | "auth"
  >,
>(request: T, curl: CurlImport): T {
  return {
    ...request,
    method: curl.method,
    url: curl.url,
    params: curl.params,
    headers: curl.headers,
    body: curl.body,
    auth: curl.auth ?? request.auth,
  };
}
