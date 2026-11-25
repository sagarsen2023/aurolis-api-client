import { useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import { runStatesAtom, type RunState } from "@/context/collections-context";
import { requestTimeoutAtom } from "@/context/settings-atoms";
import { prepareGraphql, prepareHttp } from "@/lib/prepare-request";
import { EngineFailure, newRunId } from "@/services/config/engine-bridge";
import { graphqlEngineService } from "@/services/graphql-engine.service";
import { httpEngineService } from "@/services/http-engine.service";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";
import { useRequestContext } from "./use-request-context";

const IDLE: RunState = { status: "idle" };

type HttpLike = Extract<SavedRequest, { protocol: "http" | "graphql" }>;

function toErrorState(error: unknown): RunState {
  if (error instanceof EngineFailure) {
    return { status: "error", code: error.code, message: error.message };
  }
  const message = error instanceof Error ? error.message : "Request failed.";
  return { status: "error", code: null, message };
}

export function useRequestRunner(requestId: string) {
  const [runs, setRuns] = useAtom(runStatesAtom);
  const timeoutSeconds = useAtomValue(requestTimeoutAtom);
  const getContext = useRequestContext(requestId);
  const state = runs[requestId] ?? IDLE;
  const timeoutMs = Number(timeoutSeconds) * 1000;

  const settle = useCallback(
    (runId: string, next: RunState) =>
      setRuns((current) => {
        const running = current[requestId];
        if (running?.status !== "running" || running.runId !== runId) {
          return current;
        }
        return { ...current, [requestId]: next };
      }),
    [requestId, setRuns],
  );

  const execute = useCallback(
    async (request: HttpLike, runId: string): Promise<RunState> => {
      const context = getContext();
      if (request.protocol === "http") {
        const prepared = prepareHttp(request, context);
        const response = await httpEngineService.send({
          runId,
          method: request.method,
          url: prepared.url,
          headers: prepared.headers,
          body: prepared.body,
          timeoutMs,
        });
        return {
          status: "done",
          response,
          graphqlErrors: null,
          unresolved: prepared.unresolved,
        };
      }
      const prepared = prepareGraphql(request, context);
      const result = await graphqlEngineService.send({
        runId,
        url: prepared.url,
        headers: prepared.headers,
        ...prepared.operation,
        timeoutMs,
      });
      return {
        status: "done",
        response: result.response,
        graphqlErrors: result.errorCount,
        unresolved: prepared.unresolved,
      };
    },
    [getContext, timeoutMs],
  );

  const send = useCallback(
    async (request: HttpLike) => {
      const runId = newRunId();
      setRuns((current) => ({
        ...current,
        [requestId]: { status: "running", runId, startedAt: Date.now() },
      }));
      try {
        const next = await execute(request, runId);
        settle(runId, next);
      } catch (error) {
        settle(runId, toErrorState(error));
      }
    },
    [execute, requestId, setRuns, settle],
  );

  const cancel = useCallback(() => {
    if (state.status !== "running") return;
    void httpEngineService.cancel(state.runId).catch(() => undefined);
  }, [state]);

  return { state, send, cancel };
}
