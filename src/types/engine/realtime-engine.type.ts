import type { MessageFormat } from "../workspace/request.type.ts";
import type { HeaderPair } from "./engine.type.ts";

export type RealtimeProtocol = "websocket" | "socketio";

export interface RealtimeConnectParams {
  connectionId: string;
  protocol: RealtimeProtocol;
  url: string;
  headers: HeaderPair[];
  socketioPath: string;
  socketioEvents: string[];
  timeoutMs: number;
}

export interface RealtimeSendParams {
  connectionId: string;
  event: string;
  body: string;
  format: MessageFormat;
}

export type RealtimeEventKind =
  "open" | "incoming" | "outgoing" | "error" | "close";

export interface RealtimeEvent {
  connectionId: string;
  id: string;
  kind: RealtimeEventKind;
  at: number;
  event: string | null;
  data: string;
}
