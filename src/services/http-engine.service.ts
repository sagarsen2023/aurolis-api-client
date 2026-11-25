import type { HttpSendParams } from "@/types/engine/http-engine.type";
import { engineBridge, unwrapEngine } from "./config/engine-bridge";

export const httpEngineService = {
  send: (params: HttpSendParams) =>
    unwrapEngine(engineBridge().sendHttp(params)),
  cancel: (runId: string) => unwrapEngine(engineBridge().cancel(runId)),
};
