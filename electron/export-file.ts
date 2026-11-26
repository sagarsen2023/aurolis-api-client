import { app, BrowserWindow, dialog } from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { SavedExportFile } from "../src/types/transfer/transfer.type.ts";
import { parseWorkspaceInput } from "./workspace-store.ts";

const MAX_EXPORT_BYTES = 200 * 1024 * 1024;

const saveExportFileSchema = z.object({
  name: z
    .string()
    .max(200)
    .regex(/^[^/\\:*?"<>|\0]+\.(json|zip)$/, "Use a .json or .zip file name."),
  bytes: z
    .instanceof(Uint8Array)
    .refine((bytes) => bytes.byteLength <= MAX_EXPORT_BYTES, "File too large."),
});

export async function saveExportFile(
  window: BrowserWindow | null,
  params: unknown,
): Promise<SavedExportFile> {
  const { name, bytes } = parseWorkspaceInput(saveExportFileSchema, params);
  const extension = path.extname(name).slice(1);
  const options: Electron.SaveDialogOptions = {
    title: "Export",
    defaultPath: path.join(app.getPath("downloads"), name),
    filters: [
      {
        name: extension === "zip" ? "Zip archive" : "JSON",
        extensions: [extension],
      },
    ],
  };
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { saved: false, path: null };
  await writeFile(result.filePath, bytes);
  return { saved: true, path: result.filePath };
}
