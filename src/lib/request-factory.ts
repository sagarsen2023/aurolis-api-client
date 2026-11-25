import type {
  ApiRequest,
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
