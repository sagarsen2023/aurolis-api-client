import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { UPDATE_CHECK_TIMEOUT_MS } from "@/constants/updates";
import type { AvailableUpdate } from "@/types/updates/update.type";

let pending: Update | null = null;

function toAvailable(update: Update): AvailableUpdate {
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    date: update.date ?? null,
    notes: update.body ?? "",
  };
}

export const updateService = {
  isAvailable: () => isTauri(),

  getVersion: () => getVersion(),

  async check(): Promise<AvailableUpdate | null> {
    const update = await check({ timeout: UPDATE_CHECK_TIMEOUT_MS });
    if (pending && pending !== update)
      void pending.close().catch(() => undefined);
    pending = update;
    return update ? toAvailable(update) : null;
  },

  async install(onProgress: (percent: number | null) => void) {
    if (!pending) throw new Error("Check for updates first.");
    let total = 0;
    let received = 0;
    await pending.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? 0;
        onProgress(total > 0 ? 0 : null);
      } else if (event.event === "Progress") {
        received += event.data.chunkLength;
        if (total > 0)
          onProgress(Math.min(100, Math.round((received / total) * 100)));
      } else {
        onProgress(100);
      }
    });
    await relaunch();
  },
};
