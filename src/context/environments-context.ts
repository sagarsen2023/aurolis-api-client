import { atom } from "jotai";
import type { EnvironmentSettings } from "@/types/workspace/collection-ops.type";

export const environmentDraftsAtom = atom<Record<string, EnvironmentSettings>>(
  {},
);

export const selectedEnvironmentIdAtom = atom<string | null>(null);
