import type { EngineErrorCode } from "@/types/engine/engine.type";

export const ENGINE_ERROR_MESSAGES: Record<EngineErrorCode, string> = {
  invalid_input: "Check the request and try again.",
  invalid_url: "Enter a valid URL.",
  invalid_variables: "The GraphQL variables aren't valid.",
  timeout: "The request timed out.",
  aborted: "The request was cancelled.",
  dns: "Couldn't find the server. Check the host name.",
  refused: "The server refused the connection.",
  tls: "The secure connection failed (TLS certificate problem).",
  network: "Couldn't reach the server. Check your connection.",
  too_large: "The response is too large.",
  not_connected: "Not connected.",
  unknown: "Something went wrong.",
};

export const DETAILED_ENGINE_ERRORS = new Set<EngineErrorCode>([
  "invalid_input",
  "invalid_variables",
  "timeout",
  "refused",
  "tls",
  "network",
  "dns",
  "unknown",
]);
