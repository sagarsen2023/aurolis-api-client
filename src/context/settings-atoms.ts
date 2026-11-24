import { atom } from "jotai";
import { DEFAULT_REQUEST_TIMEOUT } from "@/constants/settings";
import { WORKSPACES } from "@/constants/workspaces";

export const workspaceNamesAtom = atom<Record<string, string>>(
  Object.fromEntries(
    WORKSPACES.map((workspace) => [workspace.id, workspace.name]),
  ),
);

export const requestTimeoutAtom = atom(DEFAULT_REQUEST_TIMEOUT);

export const confirmCloseAtom = atom(true);

export const connectedAssistantsAtom = atom<Record<string, boolean>>({});
