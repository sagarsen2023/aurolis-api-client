import type { CommitParams } from "@/types/workspace/source-control.type";
import { desktopBridge } from "./config/desktop-bridge";
import { unwrapWorkspace } from "./workspace.service";

const bridge = () =>
  desktopBridge(
    "sourceControl",
    "Source control is only available in the desktop app.",
  );

export const sourceControlService = {
  changes: (workspaceId: string) =>
    unwrapWorkspace(bridge().changes(workspaceId)),
  commit: (params: CommitParams) => unwrapWorkspace(bridge().commit(params)),
};
