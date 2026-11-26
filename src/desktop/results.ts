import type { EngineResult } from "@/types/engine/engine.type";
import type { WorkspaceResult } from "@/types/workspace/workspace-store.type";

export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message?: string } };

export class BridgeError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "BridgeError";
    this.code = code;
  }
}

export function unwrap<T>(outcome: Outcome<T>): T {
  if (!outcome.ok)
    throw new BridgeError(outcome.error.code, outcome.error.message);
  return outcome.data;
}

function failureOf(error: unknown) {
  if (error instanceof BridgeError) {
    return error.message === error.code
      ? { code: error.code }
      : { code: error.code, message: error.message };
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : undefined;
  return message ? { code: "unknown", message } : { code: "unknown" };
}

export async function asWorkspaceResult<T>(
  work: () => Promise<T>,
): Promise<WorkspaceResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, error: failureOf(error) } as WorkspaceResult<T>;
  }
}

export async function asEngineResult<T>(
  work: () => Promise<T>,
): Promise<EngineResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, error: failureOf(error) } as EngineResult<T>;
  }
}

export async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    throw new BridgeError("unknown", failureOf(error).message);
  }
}
