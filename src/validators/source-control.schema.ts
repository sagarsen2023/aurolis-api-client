import { z } from "zod";

export const commitParamsSchema = z.object({
  workspaceId: z.string().min(1).max(100),
  message: z
    .string()
    .trim()
    .min(1, "Write a commit message.")
    .max(10_000, "Keep the commit message under 10,000 characters."),
  sync: z.boolean(),
});
