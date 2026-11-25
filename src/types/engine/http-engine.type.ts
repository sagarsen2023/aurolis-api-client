import type { HttpMethod } from "../workspace/request.type.ts";
import type { HeaderPair } from "./engine.type.ts";

export type PreparedBody =
  | { kind: "none" }
  | { kind: "text"; text: string }
  | { kind: "urlencoded"; fields: HeaderPair[] }
  | { kind: "form-data"; fields: HeaderPair[] };

export interface HttpSendParams {
  runId: string;
  method: HttpMethod;
  url: string;
  headers: HeaderPair[];
  body: PreparedBody;
  timeoutMs: number;
}

export type BodyEncoding = "text" | "base64" | "omitted";

export interface HttpTimings {
  headersMs: number;
  totalMs: number;
}

export interface HttpResponseData {
  status: number;
  statusText: string;
  url: string;
  redirected: boolean;
  headers: HeaderPair[];
  contentType: string | null;
  body: string;
  bodyEncoding: BodyEncoding;
  size: number;
  truncated: boolean;
  timings: HttpTimings;
}
