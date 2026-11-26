import { invoke } from "@tauri-apps/api/core";
import { BridgeError, type Outcome, unwrap } from "./results";

function messageOf(error: unknown) {
  if (typeof error === "string") return error;
  return error instanceof Error ? error.message : undefined;
}

export async function call<R>(
  command: string,
  args?: Record<string, unknown>,
): Promise<R> {
  try {
    return await invoke<R>(command, args);
  } catch (error) {
    return {
      ok: false,
      error: { code: "invalid_input", message: messageOf(error) },
    } as R;
  }
}

export async function run<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return unwrap(await call<Outcome<T>>(command, args));
}

export async function plain<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new BridgeError("unknown", messageOf(error));
  }
}
