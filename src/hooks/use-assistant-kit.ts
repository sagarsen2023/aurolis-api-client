import { useCallback, useEffect, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { strToU8, zipSync } from "fflate";
import { assistantFilesAtom } from "@/context/settings-atoms";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { ASSISTANT_PATHS, buildAssistantKit } from "@/lib/assistant-kit";
import { slugify } from "@/lib/workspace-format";
import { assistantService } from "@/services/assistant.service";
import { transferService } from "@/services/transfer.service";

function kitReadme(name: string) {
  return `# Aurolis AI kit: ${name}

Teaches Claude Code and Cursor how to add API requests and saved responses to the "${name}" Aurolis workspace.

Copy both folders to the root of the repository the assistant works in, then commit them:

- \`.claude/skills/aurolis-workspace/\`: a Claude Code skill. Claude loads it when a session starts in that repository.
- \`.cursor/rules/aurolis-workspace.mdc\`: a Cursor project rule. Cursor's agent uses it when you work on the workspace files or ask about Aurolis.

If that repository isn't the workspace repository, the skill tells the assistant to clone the workspace repository next to it and open a pull request there.
`;
}

export function useAssistantKit() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const [filesByWorkspace, setFilesByWorkspace] = useAtom(assistantFilesAtom);
  const workspaceId = workspace?.entry.id ?? null;
  const installed = workspaceId
    ? (filesByWorkspace[workspaceId] ?? null)
    : null;
  const setInstalled = useCallback(
    (paths: string[]) => {
      if (!workspaceId) return;
      setFilesByWorkspace((current) => ({ ...current, [workspaceId]: paths }));
    },
    [setFilesByWorkspace, workspaceId],
  );

  const kit = useMemo(() => {
    if (!workspace?.data) return null;
    return buildAssistantKit({
      workspace: workspace.data,
      root: workspace.entry.root,
      remoteUrl: workspace.git.remoteUrl ?? workspace.entry.remote?.url ?? null,
      branch: workspace.git.branch,
    });
  }, [workspace]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setInstalled(await assistantService.installed(workspaceId));
  }, [setInstalled, workspaceId]);

  useEffect(() => {
    let active = true;
    if (!workspaceId) return undefined;
    assistantService
      .installed(workspaceId)
      .then((paths) => {
        if (active) setInstalled(paths);
      })
      .catch(() => {
        if (active) setInstalled([]);
      });
    return () => {
      active = false;
    };
  }, [setInstalled, workspaceId]);

  const install = useCallback(async () => {
    if (!workspaceId || !kit) throw new Error("Open a workspace first.");
    const written = await assistantService.install(workspaceId, kit);
    await refresh();
    return written;
  }, [kit, refresh, workspaceId]);

  const download = useCallback(async () => {
    if (!workspace || !kit) throw new Error("Open a workspace first.");
    const files: Record<string, Uint8Array> = {
      "README.md": strToU8(kitReadme(workspace.entry.name)),
    };
    for (const [path, content] of Object.entries(kit)) {
      files[path] = strToU8(content);
    }
    return transferService.saveFile({
      name: `${slugify(workspace.entry.name, "workspace")}-ai-kit.zip`,
      bytes: zipSync(files),
      skippedRequests: 0,
    });
  }, [kit, workspace]);

  const complete =
    installed !== null &&
    ASSISTANT_PATHS.every((path) => installed.includes(path));

  return { workspace, kit, installed, complete, install, download };
}
