import { atom } from "jotai";
import type { Environment } from "@/types/workspace/environment.type";
import type {
  OpenedWorkspace,
  WorkspaceListItem,
  WorkspaceRegistryView,
} from "@/types/workspace/workspace-store.type";

export type ActiveWorkspaceState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; workspace: OpenedWorkspace }
  | { status: "missing"; workspaceId: string; message: string }
  | { status: "error"; workspaceId: string | null; message: string };

export const registryAtom = atom<WorkspaceRegistryView | null>(null);

export const activeWorkspaceStateAtom = atom<ActiveWorkspaceState>({
  status: "loading",
});

export const activeWorkspaceAtom = atom<OpenedWorkspace | null>((get) => {
  const state = get(activeWorkspaceStateAtom);
  return state.status === "ready" ? state.workspace : null;
});

export const currentWorkspaceAtom = atom<WorkspaceListItem | null>((get) => {
  const registry = get(registryAtom);
  if (!registry?.activeWorkspaceId) return null;
  return (
    registry.workspaces.find((w) => w.id === registry.activeWorkspaceId) ?? null
  );
});

export const environmentIdAtom = atom<string | null>(null);

export const environmentsAtom = atom<Environment[]>(
  (get) => get(activeWorkspaceAtom)?.data?.environments ?? [],
);

export const currentEnvironmentAtom = atom<Environment | null>((get) => {
  const environments = get(environmentsAtom);
  const byId = (id: string | null | undefined) =>
    environments.find((e) => e.id === id);
  return (
    byId(get(environmentIdAtom)) ??
    byId(get(activeWorkspaceAtom)?.data?.manifest.defaultEnvironment) ??
    environments[0] ??
    null
  );
});

export const addWorkspaceOpenAtom = atom(false);

export const publishWorkspaceOpenAtom = atom(false);
export const commitDialogOpenAtom = atom(false);
