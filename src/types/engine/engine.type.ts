export type HeaderPair = [name: string, value: string];

export type EngineErrorCode =
  | "invalid_input"
  | "invalid_url"
  | "invalid_variables"
  | "timeout"
  | "aborted"
  | "dns"
  | "refused"
  | "tls"
  | "network"
  | "too_large"
  | "not_connected"
  | "unknown";

export interface EngineErrorInfo {
  code: EngineErrorCode;
  message?: string;
}

export type EngineResult<T> =
  { ok: true; data: T } | { ok: false; error: EngineErrorInfo };
