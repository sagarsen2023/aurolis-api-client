import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { githubUserAtom } from "@/context/auth-context";
import {
  activeWorkspaceStateAtom,
  environmentIdAtom,
  registryAtom,
} from "@/context/workspace-context";
import { authService } from "@/services/auth.service";
import {
  WorkspaceFailure,
  workspaceService,
} from "@/services/workspace.service";

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
