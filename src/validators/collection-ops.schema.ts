import { z } from "zod";
import {
  environmentVariableSchema,
  exampleFileSchema,
  idSchema,
  keyValueSchema,
  nameSchema,
  requestAuthSchema,
  requestFileSchema,
  requestProtocolSchema,
} from "./workspace.schema.ts";

const MAX_DESCRIPTION_LENGTH = 100_000;
const MAX_VARIABLES = 1_000;

const exampleInputSchema = exampleFileSchema.omit({ id: true, seq: true });

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
]);

export const applyCollectionOpSchema = z.object({
  workspaceId: z.string().min(1).max(100),
  op: collectionOpSchema,
});
