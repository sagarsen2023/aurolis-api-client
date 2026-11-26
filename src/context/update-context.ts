import { atom } from "jotai";
import type { UpdateState } from "@/types/updates/update.type";

export const updateStateAtom = atom<UpdateState>({
  phase: "idle",
  update: null,
  progress: null,
  error: null,
  checkedAt: null,
});

export const availableUpdateAtom = atom((get) => get(updateStateAtom).update);

export const dismissedUpdateAtom = atom<string | null>(null);

export const updatePromptAtom = atom((get) => {
  const { update, phase } = get(updateStateAtom);
  if (!update) return null;
  const busy = phase === "downloading" || phase === "installing";
  if (!busy && get(dismissedUpdateAtom) === update.version) return null;
  return update;
});
