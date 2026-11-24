import { z } from "zod";

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(100, "Use 100 characters or fewer");

export const workspaceRemoteSchema = z.object({
  url: z.string().min(1),
  github: z.object({ owner: z.string(), repo: z.string() }).nullable(),
});

export const workspaceEntrySchema = z.object({
  id: z.string().uuid(),
  name: workspaceNameSchema,
  repoDir: z.string().min(1),
  root: z.string(),
  managed: z.boolean(),
  remote: workspaceRemoteSchema.nullable(),
  createdAt: z.string(),
  lastOpenedAt: z.string(),
});

export const workspaceRegistrySchema = z.object({
  version: z.literal(1),
  storageFolder: z.string().nullable(),
  activeWorkspaceId: z.string().nullable(),
  workspaces: z.array(workspaceEntrySchema),
});

export type WorkspaceRegistry = z.infer<typeof workspaceRegistrySchema>;
