import { Cloud } from "lucide-react";

/** Static for now: there are no unsaved drafts yet. */
function SavePill() {
  return (
    <span
      role="status"
      className="inline-flex h-10 items-center gap-2 rounded-full border border-input bg-card px-4 text-sm text-foreground"
    >
      <Cloud className="size-4" strokeWidth={1.8} aria-hidden />
      All saved
    </span>
  );
}

export default SavePill;
