export type HttpMethod =
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type RequestProtocol = "http" | "graphql" | "websocket" | "socketio";

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export type RequestBodyMode =
  "none" | "json" | "text" | "xml" | "urlencoded" | "form-data";

export type RequestBody =
  | { mode: "none" }
  | { mode: "json" | "text" | "xml"; raw: string }
  | { mode: "urlencoded" | "form-data"; fields: KeyValue[] };

export type RequestAuth =
  | { type: "inherit" }
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "apikey"; key: string; value: string; in: "header" | "query" };

export type RequestAuthType = RequestAuth["type"];

export interface RequestExample {
  id: string;
  name: string;
  seq: number;
  status: number;
  headers: KeyValue[];
  body: string;
}

export type MessageFormat = "json" | "text";

export interface SavedMessage {
  id: string;
  name: string;
  event: string;
  body: string;
  format: MessageFormat;
}

export interface GraphqlOperation {
  query: string;
  variables: string;
  operationName: string;
}

export interface SocketioOptions {
  path: string;
  events: string[];
}

interface RequestBase {
  type: "request";
  id: string;
  name: string;
  seq: number;
  description: string;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  auth: RequestAuth;
  examples: RequestExample[];
}

export interface HttpRequest extends RequestBase {
  protocol: "http";
  method: HttpMethod;
  body: RequestBody;
}

export interface GraphqlRequest extends RequestBase {
  protocol: "graphql";
  graphql: GraphqlOperation;
}

export interface WebsocketRequest extends RequestBase {
  protocol: "websocket";
  messages: SavedMessage[];
}

export interface SocketioRequest extends RequestBase {
  protocol: "socketio";
  messages: SavedMessage[];
  socketio: SocketioOptions;
}

export type RealtimeRequest = WebsocketRequest | SocketioRequest;

export type ApiRequest =
  HttpRequest | GraphqlRequest | WebsocketRequest | SocketioRequest;
