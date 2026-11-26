import type { UpdateState } from "@/types/updates/update.type";

export function progressLabel(state: UpdateState) {
  if (state.phase === "installing") return "Installing… Aurolis will restart.";
  if (state.progress === null) return "Downloading…";
  return `Downloading… ${state.progress}%`;
}
