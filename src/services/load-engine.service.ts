import type {
  LoadSnapshot,
  LoadStartParams,
} from "@/types/engine/load-engine.type";
import { engineBridge, unwrapEngine } from "./config/engine-bridge";

export const loadEngineService = {
  start: (params: LoadStartParams) =>
    unwrapEngine(engineBridge().startLoad(params)),
  stop: (runId: string) => unwrapEngine(engineBridge().stopLoad(runId)),
  onSnapshot: (callback: (snapshot: LoadSnapshot) => void) =>
    engineBridge().onLoadEvent(callback),
};
