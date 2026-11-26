import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { UPDATE_NOTES_FALLBACK } from "@/constants/updates";

const MarkdownViewer = lazy(
  () => import("@/components/ui/markdown-editor/markdown-viewer"),
);

export function ReleaseNotes({
  notes,
  className,
}: Readonly<{ notes: string; className?: string }>) {
  const content = notes.trim() || UPDATE_NOTES_FALLBACK;
  return (
    <div
      className={cn(
        "overflow-y-auto rounded-xl border border-line bg-surface-panel px-4 py-3 text-sm",
        className,
      )}
    >
      <Suspense
        fallback={<p className="whitespace-pre-wrap text-mute">{content}</p>}
      >
        <MarkdownViewer content={content} />
      </Suspense>
    </div>
  );
}
