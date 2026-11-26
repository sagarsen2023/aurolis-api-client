import type { ExportFile } from "@/types/transfer/transfer.type";
import { desktopBridge } from "./config/desktop-bridge";
import { unwrapWorkspace } from "./workspace.service";

const bridge = () =>
  desktopBridge("transfer", "Export is only available in the desktop app.");

export const transferService = {
  saveFile: (file: ExportFile) =>
    unwrapWorkspace(bridge().saveFile({ name: file.name, bytes: file.bytes })),
};
