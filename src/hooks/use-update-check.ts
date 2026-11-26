import { useEffect } from "react";
import { useSetAtom } from "jotai";
import {
  FIRST_UPDATE_CHECK_DELAY_MS,
  UPDATE_CHECK_INTERVAL_MS,
} from "@/constants/updates";
import { updateStateAtom } from "@/context/update-context";
import { updateService } from "@/services/update.service";

export function useUpdateCheck() {
  const setState = useSetAtom(updateStateAtom);

  useEffect(() => {
    if (!updateService.isAvailable()) return;
    let active = true;
    const run = () => {
      void updateService
        .check()
        .then((update) => {
          if (!active) return;
          setState((state) =>
            state.phase === "downloading" || state.phase === "installing"
              ? state
              : {
                  phase: update ? "available" : "up-to-date",
                  update,
                  progress: null,
                  error: null,
                  checkedAt: new Date().toISOString(),
                },
          );
        })
        .catch(() => undefined);
    };
    const first = window.setTimeout(run, FIRST_UPDATE_CHECK_DELAY_MS);
    const interval = window.setInterval(run, UPDATE_CHECK_INTERVAL_MS);
    return () => {
      active = false;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [setState]);
}
