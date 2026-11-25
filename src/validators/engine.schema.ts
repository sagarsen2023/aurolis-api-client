import { z } from "zod";
import { httpMethodSchema } from "./workspace.schema.ts";

const MAX_URL_LENGTH = 16_384;
const MAX_HEADERS = 200;
const MAX_TEXT_BODY = 50 * 1024 * 1024;
const MAX_FIELDS = 1_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 10 * 60 * 1_000;

const runIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

const headerNameSchema = z
  .string()
  .min(1)
  .max(1_024)
  .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, "Invalid header name");

const headerValueSchema = z
  .string()
  .max(65_536)
  .refine((value) => !/[\r\n\0]/.test(value), "Invalid header value");

export const headerPairsSchema = z
  .array(z.tuple([headerNameSchema, headerValueSchema]))
  .max(MAX_HEADERS);

const fieldPairsSchema = z
  .array(z.tuple([z.string().max(10_000), z.string().max(MAX_TEXT_BODY)]))
  .max(MAX_FIELDS);

const timeoutSchema = z.number().int().min(MIN_TIMEOUT_MS).max(MAX_TIMEOUT_MS);

const urlSchema = (protocols: readonly string[]) =>
  z
    .string()
    .trim()
    .min(1, "Enter a URL")
    .max(MAX_URL_LENGTH)
    .refine(
      (value) => {
        try {
          return protocols.includes(new URL(value).protocol);
        } catch {
          return false;
        }
      },
      `Enter a URL that starts with ${protocols.map((p) => `${p}//`).join(", ")}.`,
    );

export const httpUrlSchema = urlSchema(["http:", "https:"]);
export const realtimeUrlSchema = urlSchema(["ws:", "wss:", "http:", "https:"]);

export const preparedBodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("text"), text: z.string().max(MAX_TEXT_BODY) }),
  z.object({ kind: z.literal("urlencoded"), fields: fieldPairsSchema }),
  z.object({ kind: z.literal("form-data"), fields: fieldPairsSchema }),
]);

export const httpSendSchema = z.object({
  runId: runIdSchema,
  method: httpMethodSchema,
  url: httpUrlSchema,
  headers: headerPairsSchema,
  body: preparedBodySchema,
  timeoutMs: timeoutSchema,
});

export const graphqlSendSchema = z.object({
  runId: runIdSchema,
  url: httpUrlSchema,
  headers: headerPairsSchema,
  query: z.string().max(MAX_TEXT_BODY),
  variables: z.string().max(MAX_TEXT_BODY),
  operationName: z.string().max(1_000),
  timeoutMs: timeoutSchema,
});

export const graphqlIntrospectSchema = z.object({
  url: httpUrlSchema,
  headers: headerPairsSchema,
  timeoutMs: timeoutSchema,
});

export const realtimeConnectSchema = z.object({
  connectionId: runIdSchema,
  protocol: z.enum(["websocket", "socketio"]),
  url: realtimeUrlSchema,
  headers: headerPairsSchema,
  socketioPath: z
    .string()
    .max(1_000)
    .regex(/^\/[^\s?#]*$/, "The path must start with /"),
  socketioEvents: z.array(z.string().min(1).max(200)).max(100),
  timeoutMs: timeoutSchema,
});

export const realtimeSendSchema = z.object({
  connectionId: runIdSchema,
  event: z.string().max(200),
  body: z.string().max(MAX_TEXT_BODY),
  format: z.enum(["json", "text"]),
});

export const runIdParamSchema = runIdSchema;
