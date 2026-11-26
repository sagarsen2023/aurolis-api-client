import { z } from "zod";
import type {
  EngineErrorCode,
  EngineErrorInfo,
  EngineResult,
} from "../../src/types/engine/engine.type.ts";

export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message?: string) {
    super(message ?? code);
    this.name = "EngineError";
    this.code = code;
  }
}

const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_NONAME"]);
const REFUSED_CODES = new Set(["ECONNREFUSED"]);
const NETWORK_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function errorCodeOf(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const record = error as { code?: unknown; cause?: unknown };
  if (typeof record.code === "string") return record.code;
  return errorCodeOf(record.cause);
}

function deepestMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const nested = deepestMessage(error.cause);
  return nested ?? error.message;
}

function isTlsCode(code: string) {
  return (
    code.startsWith("ERR_TLS") ||
    code.startsWith("ERR_SSL") ||
    code.includes("CERT") ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT"
  );
}

function codeFor(systemCode: string | null): EngineErrorCode {
  if (!systemCode) return "network";
  if (DNS_CODES.has(systemCode)) return "dns";
  if (REFUSED_CODES.has(systemCode)) return "refused";
  if (isTlsCode(systemCode)) return "tls";
  if (NETWORK_CODES.has(systemCode)) return "network";
  return "network";
}

function describeIssues(error: z.ZodError) {
  const messages = error.issues.map((issue) => issue.message);
  return [...new Set(messages)].join(" ");
}

export function toEngineError(error: unknown): EngineError {
  if (error instanceof EngineError) return error;
  if (error instanceof z.ZodError) {
    return new EngineError("invalid_input", describeIssues(error));
  }
  const systemCode = errorCodeOf(error);
  return new EngineError(codeFor(systemCode), deepestMessage(error));
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new EngineError("invalid_input", describeIssues(result.error));
  }
  return result.data;
}

export async function toEngineResult<T>(
  operation: () => Promise<T>,
): Promise<EngineResult<T>> {
  try {
    const data = await operation();
    return { ok: true, data };
  } catch (caught) {
    const error = toEngineError(caught);
    const info: EngineErrorInfo = { code: error.code };
    if (error.message !== error.code) info.message = error.message;
    return { ok: false, error: info };
  }
}
