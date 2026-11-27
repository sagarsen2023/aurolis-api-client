import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { DEFAULT_REQUEST_TIMEOUT } from "@/constants/settings";
import { DEFAULT_ZOOM, ZOOM_STORAGE_KEY } from "@/constants/zoom";

export const requestTimeoutAtom = atom(DEFAULT_REQUEST_TIMEOUT);

export const confirmCloseAtom = atom(true);

export const assistantFilesAtom = atom<Record<string, string[]>>({});

export const zoomAtom = atomWithStorage(
  ZOOM_STORAGE_KEY,
  DEFAULT_ZOOM,
  undefined,
  {
    getOnInit: true,
  },
);
