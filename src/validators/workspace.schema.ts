import { z } from "zod";

export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, - and _");

export const nameSchema = z.string().trim().min(1).max(200);

const seqSchema = z.number().finite();

export const keyValueSchema = z.object({
  key: z.string(),
  value: z.string().default(""),
  enabled: z.boolean().default(true),
});

export const httpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

export const requestBodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.enum(["json", "text", "xml"]), raw: z.string() }),
  z.object({
    mode: z.enum(["urlencoded", "form-data"]),
    fields: z.array(keyValueSchema),
  }),
]);

export const requestAuthSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("inherit") }),
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("bearer"), token: z.string() }),
  z.object({
    type: z.literal("basic"),
    username: z.string(),
    password: z.string(),
  }),
  z.object({
    type: z.literal("apikey"),
    key: z.string(),
    value: z.string(),
    in: z.enum(["header", "query"]),
  }),
]);

export const manifestFileSchema = z.object({
  format: z.number().int().positive(),
  workspace: z.object({ id: idSchema, name: nameSchema }),
  description: z.string().default(""),
  defaultEnvironment: idSchema.nullable().default(null),
});

export const collectionFileSchema = z.object({
  id: idSchema,
  name: nameSchema,
  seq: seqSchema,
  description: z.string().default(""),
  auth: requestAuthSchema.default({ type: "none" }),
  variables: z.array(keyValueSchema).default([]),
});

export const folderFileSchema = z.object({
  id: idSchema,
  name: nameSchema,
  seq: seqSchema,
  description: z.string().default(""),
  auth: requestAuthSchema.default({ type: "inherit" }),
});

export const requestProtocolSchema = z.enum([
  "http",
  "graphql",
  "websocket",
  "socketio",
]);

export const savedMessageSchema = z.object({
  id: idSchema,
  name: z.string().max(200).default(""),
  event: z.string().max(200).default(""),
  body: z.string().default(""),
  format: z.enum(["json", "text"]).default("text"),
});

const requestBaseShape = {
  id: idSchema,
  name: nameSchema,
  seq: seqSchema,
  description: z.string().default(""),
  url: z.string().default(""),
  params: z.array(keyValueSchema).default([]),
  headers: z.array(keyValueSchema).default([]),
  auth: requestAuthSchema.default({ type: "inherit" }),
};

const httpRequestFileSchema = z.object({
  ...requestBaseShape,
  protocol: z.literal("http"),
  method: httpMethodSchema,
  body: requestBodySchema.default({ mode: "none" }),
});

const graphqlRequestFileSchema = z.object({
  ...requestBaseShape,
  protocol: z.literal("graphql"),
  graphql: z
    .object({
      query: z.string().default(""),
      variables: z.string().default(""),
      operationName: z.string().default(""),
    })
    .default({ query: "", variables: "", operationName: "" }),
});

const websocketRequestFileSchema = z.object({
  ...requestBaseShape,
  protocol: z.literal("websocket"),
  messages: z.array(savedMessageSchema).default([]),
});

const socketioRequestFileSchema = z.object({
  ...requestBaseShape,
  protocol: z.literal("socketio"),
  messages: z.array(savedMessageSchema).default([]),
  socketio: z
    .object({
      path: z.string().default("/socket.io"),
      events: z.array(z.string().max(200)).default([]),
    })
    .default({ path: "/socket.io", events: [] }),
});

const withDefaultProtocol = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  if ("protocol" in value) return value;
  return { ...value, protocol: "http" };
};

export const requestFileSchema = z.preprocess(
  withDefaultProtocol,
  z.discriminatedUnion("protocol", [
    httpRequestFileSchema,
    graphqlRequestFileSchema,
    websocketRequestFileSchema,
    socketioRequestFileSchema,
  ]),
);

export const exampleFileSchema = z.object({
  id: idSchema,
  name: nameSchema,
  seq: seqSchema,
  status: z.number().int().min(100).max(599),
  headers: z.array(keyValueSchema).default([]),
  body: z.string().default(""),
});

export const environmentVariableSchema = z.object({
  key: z.string(),
  value: z.string().default(""),
  enabled: z.boolean().default(true),
  secret: z.boolean().default(false),
});

export const environmentFileSchema = z.object({
  id: idSchema,
  name: nameSchema,
  seq: seqSchema.default(0),
  variables: z.array(environmentVariableSchema).default([]),
});

export type ManifestFile = z.infer<typeof manifestFileSchema>;
export type CollectionFile = z.infer<typeof collectionFileSchema>;
export type FolderFile = z.infer<typeof folderFileSchema>;
export type RequestFile = z.infer<typeof requestFileSchema>;
export type ExampleFile = z.infer<typeof exampleFileSchema>;
export type EnvironmentFile = z.infer<typeof environmentFileSchema>;
