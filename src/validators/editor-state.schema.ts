import { z } from "zod";
import { idSchema, requestFileSchema } from "./workspace.schema.ts";

const MAX_TABS = 50;
const MAX_DRAFTS = 500;

export const editorTabSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("request"), id: idSchema }),
  z.object({ kind: z.literal("example"), id: idSchema, requestId: idSchema }),
  z.object({ kind: z.literal("collection"), id: idSchema }),
  z.object({ kind: z.literal("folder"), id: idSchema }),
]);

export const editorUiStateSchema = z.object({
  tabs: z.array(editorTabSchema).max(MAX_TABS),
  activeTabId: idSchema.nullable(),
  environmentId: idSchema.nullable().default(null),
});

export const requestDraftsSchema = z
  .record(idSchema, requestFileSchema)
  .refine((drafts) => Object.keys(drafts).length <= MAX_DRAFTS, {
    message: `At most ${MAX_DRAFTS} drafts.`,
  });

const workspaceIdSchema = z.string().min(1).max(100);

export const saveDraftsSchema = z.object({
  workspaceId: workspaceIdSchema,
  drafts: requestDraftsSchema,
});

export const saveUiStateSchema = z.object({
  workspaceId: workspaceIdSchema,
  ui: editorUiStateSchema,
});
