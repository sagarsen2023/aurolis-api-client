import type { HeaderPair } from "./engine.type.ts";
import type { HttpSendParams } from "./http-engine.type.ts";

export type LoadTarget =
  | ({ kind: "http" } & Omit<HttpSendParams, "runId">)
  | {
      kind: "graphql";
      url: string;
      headers: HeaderPair[];
      query: string;
      variables: string;
      operationName: string;
      timeoutMs: number;
    };

export type LoadLimit =
  { kind: "duration"; seconds: number } | { kind: "requests"; count: number };

export interface LoadStartParams {
  runId: string;
  target: LoadTarget;
  virtualUsers: number;
  limit: LoadLimit;
  rampUpSeconds: number;
  thinkTimeMs: number;
}

export interface LatencySummary {
  min: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

export interface LoadSecondPoint {
  second: number;
  requests: number;
  failed: number;
  p50: number;
  p95: number;
}

export interface LoadErrorCount {
  code: string;
  message?: string | null;
  count: number;
}

export type LoadRunState = "running" | "completed" | "stopped";

export interface LoadSnapshot {
  runId: string;
  state: LoadRunState;
  elapsedMs: number;
  activeUsers: number;
  total: number;
  failed: number;
  bytes: number;
  requestsPerSecond: number;
  latency: LatencySummary | null;
  statuses: [status: number, count: number][];
  errors: LoadErrorCount[];
  points: LoadSecondPoint[];
}
