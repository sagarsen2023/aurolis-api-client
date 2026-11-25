import type {
  RealtimeConnectParams,
  RealtimeEvent,
  RealtimeSendParams,
} from "@/types/engine/realtime-engine.type";
import { engineBridge, unwrapEngine } from "./config/engine-bridge";

export const realtimeEngineService = {
  connect: (params: RealtimeConnectParams) =>
    unwrapEngine(engineBridge().connectRealtime(params)),
  send: (params: RealtimeSendParams) =>
    unwrapEngine(engineBridge().sendRealtime(params)),
  disconnect: (connectionId: string) =>
    unwrapEngine(engineBridge().disconnectRealtime(connectionId)),
  onEvent: (callback: (event: RealtimeEvent) => void) =>
    window.aurolis?.engine.onRealtimeEvent(callback) ?? (() => undefined),
};
