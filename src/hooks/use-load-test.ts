import { useCallback, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { toast } from "sonner";
import { draftsAtom } from "@/context/collections-context";
import {
  loadHistoryAtom,
  loadRunAtom,
  loadRunningAtom,
  MAX_LOAD_HISTORY,
  type LoadConfig,
  type LoadRun,
} from "@/context/load-testing-context";
import { requestTimeoutAtom } from "@/context/settings-atoms";
import {
  activeWorkspaceAtom,
  currentEnvironmentAtom,
} from "@/context/workspace-context";
import { locateRequest } from "@/lib/collection-ops";
import { prepareGraphql, prepareHttp } from "@/lib/prepare-request";
import { toSavedRequest } from "@/lib/request-draft";
import { newRunId } from "@/services/config/engine-bridge";
import { loadEngineService } from "@/services/load-engine.service";
import type {
  LoadLimit,
  LoadSnapshot,
  LoadTarget,
} from "@/types/engine/load-engine.type";

export function useLoadEventsListener() {
  const setRun = useSetAtom(loadRunAtom);
  const setHistory = useSetAtom(loadHistoryAtom);

  useEffect(() => {
    const onSnapshot = (snapshot: LoadSnapshot) => {
      const finished: { run: LoadRun | null } = { run: null };
      setRun((current) => {
        if (current?.runId !== snapshot.runId) return current;
        const next = { ...current, snapshot };
        if (snapshot.state !== "running") finished.run = next;
        return next;
      });
      const run = finished.run;
      if (run) {
        setHistory((history) =>
          [run, ...history.filter((entry) => entry.runId !== run.runId)].slice(
            0,
            MAX_LOAD_HISTORY,
          ),
        );
      }
    };
    try {
      return loadEngineService.onSnapshot(onSnapshot);
    } catch {
      return undefined;
    }
  }, [setHistory, setRun]);
}

function limitOf(config: LoadConfig): LoadLimit {
  return config.limitKind === "duration"
    ? { kind: "duration", seconds: config.durationSeconds }
    : { kind: "requests", count: config.requestCount };
}

export function useLoadTest() {
  const [run, setRun] = useAtom(loadRunAtom);
  const running = useAtomValue(loadRunningAtom);
  const workspace = useAtomValue(activeWorkspaceAtom);
  const environment = useAtomValue(currentEnvironmentAtom);
  const drafts = useAtomValue(draftsAtom);
  const timeoutSeconds = useAtomValue(requestTimeoutAtom);

  const start = useCallback(
    async (config: LoadConfig) => {
      const data = workspace?.data ?? null;
      const location = config.requestId
        ? locateRequest(data, config.requestId)
        : null;
      if (!location || !config.requestId) {
        throw new Error("Choose a request to test.");
      }
      const request =
        drafts[config.requestId] ?? toSavedRequest(location.request);
      const context = {
        collection: location.collection,
        folders: location.folders,
        environment,
        globals: data?.globals ?? null,
      };
      const timeoutMs = Number(timeoutSeconds) * 1000;
      let target: LoadTarget;
      let unresolved: string[];
      if (request.protocol === "http") {
        const prepared = prepareHttp(request, context);
        unresolved = prepared.unresolved;
        target = {
          kind: "http",
          method: request.method,
          url: prepared.url,
          headers: prepared.headers,
          body: prepared.body,
          timeoutMs,
        };
      } else if (request.protocol === "graphql") {
        const prepared = prepareGraphql(request, context);
        unresolved = prepared.unresolved;
        target = {
          kind: "graphql",
          url: prepared.url,
          headers: prepared.headers,
          ...prepared.operation,
          timeoutMs,
        };
      } else {
        throw new Error("Load tests run HTTP and GraphQL requests.");
      }
      if (unresolved.length > 0) {
        toast.warning(
          `Not set in this environment: ${unresolved.map((name) => `{{${name}}}`).join(", ")}`,
        );
      }
      const runId = newRunId();
      setRun({
        runId,
        requestId: config.requestId,
        requestName: request.name,
        protocol: request.protocol,
        method: request.protocol === "http" ? request.method : "POST",
        environmentName: environment?.name ?? null,
        config,
        startedAt: Date.now(),
        snapshot: null,
      });
      try {
        await loadEngineService.start({
          runId,
          target,
          virtualUsers: config.virtualUsers,
          limit: limitOf(config),
          rampUpSeconds: config.rampUpSeconds,
          thinkTimeMs: config.thinkTimeMs,
        });
      } catch (error) {
        setRun((current) => (current?.runId === runId ? null : current));
        throw error;
      }
    },
    [drafts, environment, setRun, timeoutSeconds, workspace],
  );

  const stop = useCallback(async () => {
    if (run) await loadEngineService.stop(run.runId);
  }, [run]);

  return { run, running, start, stop };
}
