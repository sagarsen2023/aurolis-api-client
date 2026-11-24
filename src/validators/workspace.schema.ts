import { z } from "zod";

const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, - and _");

const nameSchema = z.string().trim().min(1).max(200);

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
  auth: requestAuthSchema.default({ type: "inherit" }),
});

export const requestFileSchema = z.object({
  id: idSchema,
  name: nameSchema,
  seq: seqSchema,
  method: httpMethodSchema,
  url: z.string().default(""),
  params: z.array(keyValueSchema).default([]),
  headers: z.array(keyValueSchema).default([]),
  body: requestBodySchema.default({ mode: "none" }),
  auth: requestAuthSchema.default({ type: "inherit" }),
});

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
