import {
  DETAILED_ENGINE_ERRORS,
  ENGINE_ERROR_MESSAGES,
} from "@/constants/engine";
import type {
  EngineErrorCode,
  EngineErrorInfo,
  EngineResult,
} from "@/types/engine/engine.type";

export class EngineFailure extends Error {
  readonly code: EngineErrorCode;
  readonly detail: string | undefined;

  constructor(info: EngineErrorInfo) {
    const base =
      ENGINE_ERROR_MESSAGES[info.code] ?? ENGINE_ERROR_MESSAGES.unknown;
    const showDetail =
      Boolean(info.message) && DETAILED_ENGINE_ERRORS.has(info.code);
    super(showDetail ? `${base} ${info.message}` : base);
    this.name = "EngineFailure";
    this.code = info.code;
    this.detail = info.message;
  }
}

export function engineBridge() {
  const engine = window.aurolis?.engine;
  if (!engine) {
    throw new Error("Sending requests is only available in the desktop app.");
  }
  return engine;
}

export async function unwrapEngine<T>(
  result: Promise<EngineResult<T>>,
): Promise<T> {
  const response = await result;
  if (!response.ok) throw new EngineFailure(response.error);
  return response.data;
}

export function newRunId() {
  return crypto.randomUUID();
}
