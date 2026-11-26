import { z } from "zod";
import type { CollectionItem } from "../types/workspace/collection.type.ts";
import {
  collectionFileSchema,
  environmentVariableSchema,
  exampleFileSchema,
  folderFileSchema,
  idSchema,
  keyValueSchema,
  nameSchema,
  requestAuthSchema,
  requestFileSchema,
  requestProtocolSchema,
} from "./workspace.schema.ts";

const MAX_DESCRIPTION_LENGTH = 100_000;
const MAX_VARIABLES = 1_000;
const MAX_IMPORT_DEPTH = 32;
const MAX_IMPORT_ITEMS = 20_000;
const MAX_EXAMPLES = 1_000;

const exampleInputSchema = exampleFileSchema.omit({ id: true, seq: true });

const importedRequestSchema = z.intersection(
  requestFileSchema,
  z.object({
    type: z.literal("request"),
    examples: z.array(exampleFileSchema).max(MAX_EXAMPLES),
  }),
);

const importedItemSchema: z.ZodType<CollectionItem> = z.lazy(() =>
  z.union([importedFolderSchema, importedRequestSchema]),
);

const importedFolderSchema = folderFileSchema.extend({
  type: z.literal("folder"),
  items: z.array(importedItemSchema),
});

function withinImportLimits(value: unknown) {
  const pending: Array<[unknown, number]> = [[value, 0]];
  let count = 0;
  while (pending.length > 0) {
    const [node, depth] = pending.pop() as [unknown, number];
    if (depth > MAX_IMPORT_DEPTH) return false;
    if (!node || typeof node !== "object") continue;
    const { items } = node as { items?: unknown };
    if (!Array.isArray(items)) continue;
    count += items.length;
    if (count > MAX_IMPORT_ITEMS) return false;
    for (const item of items) pending.push([item, depth + 1]);
  }
  return true;
}

const importedCollectionSchema = z
  .unknown()
  .refine(
    withinImportLimits,
    `Use at most ${MAX_IMPORT_ITEMS.toLocaleString("en")} items, nested at most ${MAX_IMPORT_DEPTH} folders deep.`,
  )
  .pipe(
    collectionFileSchema.extend({
      variables: z.array(keyValueSchema).max(MAX_VARIABLES),
      items: z.array(importedItemSchema),
    }),
  );

const collectionOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("update-workspace"),
    description: z.string().max(MAX_DESCRIPTION_LENGTH),
  }),
  z.object({ op: z.literal("create-environment"), name: nameSchema }),
  z.object({
    op: z.literal("update-environment"),
    id: idSchema,
    settings: z.object({
      name: nameSchema,
      variables: z.array(environmentVariableSchema).max(MAX_VARIABLES),
    }),
  }),
  z.object({ op: z.literal("duplicate-environment"), id: idSchema }),
  z.object({ op: z.literal("delete-environment"), id: idSchema }),
  z.object({
    op: z.literal("update-globals"),
    variables: z.array(environmentVariableSchema).max(MAX_VARIABLES),
  }),
  z.object({
    op: z.literal("set-default-environment"),
    id: idSchema.nullable(),
  }),
  z.object({
    op: z.literal("create-collection"),
    name: nameSchema,
    description: z.string().max(MAX_DESCRIPTION_LENGTH).default(""),
  }),
  z.object({
    op: z.literal("update-collection"),
    id: idSchema,
    settings: z.object({
      name: nameSchema,
      description: z.string().max(MAX_DESCRIPTION_LENGTH),
      auth: requestAuthSchema,
      variables: z.array(keyValueSchema),
    }),
  }),
  z.object({ op: z.literal("delete-collection"), id: idSchema }),
  z.object({
    op: z.literal("create-folder"),
    parentId: idSchema,
    name: nameSchema,
  }),
  z.object({
    op: z.literal("update-folder"),
    id: idSchema,
    settings: z.object({
      name: nameSchema,
      description: z.string().max(MAX_DESCRIPTION_LENGTH),
      auth: requestAuthSchema,
    }),
  }),
  z.object({ op: z.literal("delete-folder"), id: idSchema }),
  z.object({
    op: z.literal("create-request"),
    parentId: idSchema,
    name: nameSchema,
    protocol: requestProtocolSchema,
  }),
  z.object({ op: z.literal("save-request"), request: requestFileSchema }),
  z.object({ op: z.literal("duplicate-request"), id: idSchema }),
  z.object({ op: z.literal("delete-request"), id: idSchema }),
  z.object({
    op: z.literal("create-example"),
    requestId: idSchema,
    example: exampleInputSchema,
  }),
  z.object({
    op: z.literal("update-example"),
    id: idSchema,
    example: exampleInputSchema,
  }),
  z.object({ op: z.literal("delete-example"), id: idSchema }),
  z.object({
    op: z.literal("import-collection"),
    collection: importedCollectionSchema,
  }),
  z.object({
    op: z.literal("import-environment"),
    environment: z.object({
      name: nameSchema,
      variables: z.array(environmentVariableSchema).max(MAX_VARIABLES),
    }),
  }),
]);

export const applyCollectionOpSchema = z.object({
  workspaceId: z.string().min(1).max(100),
  op: collectionOpSchema,
});
