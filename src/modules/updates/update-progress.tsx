import type { UpdateState } from "@/types/updates/update.type";
import { progressLabel } from "@/utils/update-progress";

export function UpdateProgress({ state }: Readonly<{ state: UpdateState }>) {
  const indeterminate =
    state.progress === null && state.phase === "downloading";
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label="Update download"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.progress ?? undefined}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
      >
        <div
          className={
            indeterminate
              ? "h-full w-1/3 animate-pulse rounded-full bg-vio"
              : "h-full rounded-full bg-vio transition-[width] duration-200"
          }
          style={
            indeterminate
              ? undefined
              : {
                  width: `${state.phase === "installing" ? 100 : (state.progress ?? 0)}%`,
                }
          }
        />
      </div>
      <p className="text-xs text-mute">{progressLabel(state)}</p>
    </div>
  );
}
