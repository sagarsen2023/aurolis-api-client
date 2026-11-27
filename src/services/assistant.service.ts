import { desktopBridge } from "./config/desktop-bridge";
import { unwrapWorkspace } from "./workspace.service";

const bridge = () =>
  desktopBridge(
    "assistants",
    "Assistant files are only available in the desktop app.",
  );

export const assistantService = {
  installed: (workspaceId: string) =>
    unwrapWorkspace(bridge().installed(workspaceId)),
  install: (workspaceId: string, files: Record<string, string>) =>
    unwrapWorkspace(bridge().install({ id: workspaceId, files })),
};
