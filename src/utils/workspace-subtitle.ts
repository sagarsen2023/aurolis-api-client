import type { WorkspaceListItem } from "@/types/workspace/workspace-store.type";

export function workspaceSubtitle(workspace: WorkspaceListItem) {
  if (workspace.missing) return "Folder not found";
  const github = workspace.remote?.github;
  if (github) return `${github.owner}/${github.repo}`;
  if (workspace.remote) return workspace.remote.url.replace(/^https?:\/\//, "");
  return "Local";
}
