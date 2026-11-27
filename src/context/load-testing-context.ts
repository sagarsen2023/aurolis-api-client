import { atom } from "jotai";
import type { LoadSnapshot } from "@/types/engine/load-engine.type";
import type { HttpMethod } from "@/types/workspace/request.type";

export type LoadLimitKind = "duration" | "requests";

export interface LoadConfig {
  requestId: string | null;
  virtualUsers: number;
  limitKind: LoadLimitKind;
  durationSeconds: number;
  requestCount: number;
  rampUpSeconds: number;
  thinkTimeMs: number;
}

export interface LoadRun {
  runId: string;
  requestId: string;
  requestName: string;
  protocol: "http" | "graphql";
  method: HttpMethod;
  environmentName: string | null;
  config: LoadConfig;
  startedAt: number;
  snapshot: LoadSnapshot | null;
}

export const DEFAULT_LOAD_CONFIG: LoadConfig = {
  requestId: null,
  virtualUsers: 10,
  limitKind: "duration",
  durationSeconds: 30,
  requestCount: 1000,
  rampUpSeconds: 0,
  thinkTimeMs: 0,
};

export const MAX_LOAD_HISTORY = 20;

export const loadConfigAtom = atom<LoadConfig>(DEFAULT_LOAD_CONFIG);

export const loadRunAtom = atom<LoadRun | null>(null);

export const loadHistoryAtom = atom<LoadRun[]>([]);

export const loadRunningAtom = atom(
  (get) =>
    get(loadRunAtom)?.snapshot?.state === "running" ||
    isStarting(get(loadRunAtom)),
);

function isStarting(run: LoadRun | null) {
  return run !== null && run.snapshot === null;
}
