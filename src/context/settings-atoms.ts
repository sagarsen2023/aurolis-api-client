import { atom } from "jotai";
import { DEFAULT_REQUEST_TIMEOUT } from "@/constants/settings";
export const requestTimeoutAtom = atom(DEFAULT_REQUEST_TIMEOUT);

export const confirmCloseAtom = atom(true);

export const assistantFilesAtom = atom<Record<string, string[]>>({});
