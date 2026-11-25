import type {
  HttpMethod,
  RequestAuthType,
  RequestBodyMode,
  RequestProtocol,
} from "@/types/workspace/request.type";

export const HTTP_METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export const METHOD_TEXT_CLASS: Record<HttpMethod, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
  HEAD: "text-method-head",
  OPTIONS: "text-dim",
};

export const PROTOCOL_OPTIONS: ReadonlyArray<{
  value: RequestProtocol;
  label: string;
  badge: string;
  badgeClass: string;
  description: string;
}> = [
  {
    value: "http",
    label: "HTTP",
    badge: "GET",
    badgeClass: "text-method-get",
    description: "REST and any other HTTP API.",
  },
  {
    value: "graphql",
    label: "GraphQL",
    badge: "GQL",
    badgeClass: "text-pur",
    description: "Queries and mutations, with schema introspection.",
  },
  {
    value: "websocket",
    label: "WebSocket",
    badge: "WS",
    badgeClass: "text-vio",
    description: "A raw WebSocket connection for text and JSON messages.",
  },
  {
    value: "socketio",
    label: "Socket.IO",
    badge: "SIO",
    badgeClass: "text-coral",
    description: "Socket.IO events over a persistent connection.",
  },
];

export const BODY_MODE_OPTIONS: ReadonlyArray<{
  value: RequestBodyMode;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "json", label: "JSON" },
  { value: "text", label: "Text" },
  { value: "xml", label: "XML" },
  { value: "urlencoded", label: "URL-encoded" },
  { value: "form-data", label: "Form data" },
];

export const BODY_CONTENT_TYPES: Partial<Record<RequestBodyMode, string>> = {
  json: "application/json",
  text: "text/plain",
  xml: "application/xml",
  urlencoded: "application/x-www-form-urlencoded",
};

export const AUTH_OPTIONS: ReadonlyArray<{
  value: RequestAuthType;
  label: string;
}> = [
  { value: "inherit", label: "Inherit from parent" },
  { value: "none", label: "No auth" },
  { value: "bearer", label: "Bearer token" },
  { value: "basic", label: "Basic auth" },
  { value: "apikey", label: "API key" },
];

export const NEW_EXAMPLE_STATUS = 200;
