import { atom } from "jotai";
import { ENVIRONMENTS, WORKSPACES } from "@/constants/workspaces";

export const workspaceIdAtom = atom(WORKSPACES[0].id);

export const currentWorkspaceAtom = atom(
  (get) =>
    WORKSPACES.find((w) => w.id === get(workspaceIdAtom)) ?? WORKSPACES[0],
);

export const environmentIdAtom = atom(ENVIRONMENTS[0].id);

export const currentEnvironmentAtom = atom(
  (get) =>
    ENVIRONMENTS.find((e) => e.id === get(environmentIdAtom)) ??
    ENVIRONMENTS[0],
);
