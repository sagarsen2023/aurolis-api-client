import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { toast } from "sonner";
import { PULL_FAILURE_MESSAGES } from "@/constants/workspace";
import { githubUserAtom } from "@/context/auth-context";
import {
  activeWorkspaceStateAtom,
  environmentIdAtom,
  registryAtom,
} from "@/context/workspace-context";
import { authService } from "@/services/auth.service";
import { sourceControlService } from "@/services/source-control.service";
import {
  WorkspaceFailure,
  workspaceService,
} from "@/services/workspace.service";

async function pullLatest(id: string, name: string) {
  try {
    const result = await sourceControlService.pull(id);
    if (result.status === "pulled") {
      toast.success(`Pulled the latest changes into ${name}`, {
        description: `${result.commits} new ${result.commits === 1 ? "commit" : "commits"} from ${result.branch}.`,
      });
    }
  } catch (error) {
    const code = error instanceof WorkspaceFailure ? error.code : "unknown";
    toast.warning(`Couldn't pull the latest changes into ${name}`, {
      description:
        PULL_FAILURE_MESSAGES[code] ??
        (error instanceof Error ? error.message : undefined),
    });
  }
}

export function useWorkspaceActions() {
  const setRegistry = useSetAtom(registryAtom);
  const setActive = useSetAtom(activeWorkspaceStateAtom);
  const setEnvironmentId = useSetAtom(environmentIdAtom);

  const reloadRegistry = useCallback(async () => {
    const registry = await workspaceService.list();
    setRegistry(registry);
    return registry;
  }, [setRegistry]);

  const openWorkspace = useCallback(
    async (id: string, options: { quiet?: boolean } = {}) => {
      if (!options.quiet) setActive({ status: "loading" });
      try {
        const workspace = await workspaceService.open(id);
        setActive({ status: "ready", workspace });
        if (!options.quiet && workspace.git.remoteUrl) {
          void pullLatest(id, workspace.entry.name);
        }
        const environments = workspace.data?.environments ?? [];
        setEnvironmentId((previous) =>
          environments.some((e) => e.id === previous)
            ? previous
            : (workspace.data?.manifest.defaultEnvironment ??
              environments[0]?.id ??
              null),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Couldn't open workspace.";
        setActive(
          error instanceof WorkspaceFailure && error.code === "missing_folder"
            ? { status: "missing", workspaceId: id, message }
            : { status: "error", workspaceId: id, message },
        );
      }
      await reloadRegistry();
    },
    [reloadRegistry, setActive, setEnvironmentId],
  );

  const openActiveOrFirst = useCallback(async () => {
    const registry = await reloadRegistry();
    const id = registry.activeWorkspaceId ?? registry.workspaces[0]?.id;
    if (id) await openWorkspace(id);
    else setActive({ status: "none" });
  }, [openWorkspace, reloadRegistry, setActive]);

  return { reloadRegistry, openWorkspace, openActiveOrFirst };
}

export function useWorkspaceBootstrap() {
  const { openActiveOrFirst, openWorkspace } = useWorkspaceActions();
  const setActive = useSetAtom(activeWorkspaceStateAtom);
  const setUser = useSetAtom(githubUserAtom);
  const active = useAtomValue(activeWorkspaceStateAtom);
  const activeId = active.status === "ready" ? active.workspace.entry.id : null;

  useEffect(() => {
    void authService.getStatus().then((status) => setUser(status.user));
    openActiveOrFirst().catch((error: unknown) =>
      setActive({
        status: "error",
        workspaceId: null,
        message:
          error instanceof Error ? error.message : "Couldn't load workspaces.",
      }),
    );
  }, [openActiveOrFirst, setActive, setUser]);

  useEffect(() => {
    if (!activeId) return;
    return workspaceService.onChanged((changedId) => {
      if (changedId === activeId)
        void openWorkspace(changedId, { quiet: true });
    });
  }, [activeId, openWorkspace]);
}
