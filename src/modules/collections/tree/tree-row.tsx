import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import NodeActions, { type NodeAction } from "./node-actions";

const INDENT_PX = 14;

function TreeRow({
  depth,
  label,
  leading,
  expanded,
  onToggle,
  onOpen,
  active,
  dirty,
  actions,
}: Readonly<{
  depth: number;
  label: string;
  leading: ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
  onOpen: () => void;
  active: boolean;
  dirty?: boolean;
  actions: NodeAction[];
}>) {
  const hasToggle = onToggle !== undefined;
  return (
    <div
      className={cn(
        "group/row flex h-8 items-center gap-1 rounded-lg pr-1 text-[13px] transition-colors",
        active
          ? "bg-surface-selected text-ink"
          : "text-foreground hover:bg-surface-hover",
      )}
      style={{ paddingLeft: depth * INDENT_PX + 4 }}
    >
      {hasToggle ? (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          onClick={onToggle}
          className="grid size-5 shrink-0 place-items-center rounded text-dim outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-90",
            )}
            aria-hidden
          />
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        onClick={onOpen}
        onDoubleClick={onToggle}
        aria-current={active ? "true" : undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {leading}
        <span className="truncate">{label}</span>
        {dirty ? (
          <span
            className="size-1.5 shrink-0 rounded-full bg-vio"
            aria-label="Unsaved changes"
          />
        ) : null}
      </button>
      <NodeActions name={label} actions={actions} />
    </div>
  );
}

export default TreeRow;
