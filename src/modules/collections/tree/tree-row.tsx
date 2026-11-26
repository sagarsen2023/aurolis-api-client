import type { ReactNode } from "react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  onToggleBranch,
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
  onToggleBranch?: () => void;
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
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          onClick={onToggle}
          className="size-5 text-dim hover:bg-transparent hover:text-ink"
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-90",
            )}
            aria-hidden
          />
        </Button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={onOpen}
        onDoubleClick={onToggle}
        aria-current={active ? "true" : undefined}
        className="h-full min-w-0 flex-1 justify-start gap-1.5 rounded px-0 hover:bg-transparent"
      >
        {leading}
        <span className="truncate">{label}</span>
        {dirty ? (
          <span
            className="size-1.5 shrink-0 rounded-full bg-vio"
            aria-label="Unsaved changes"
          />
        ) : null}
      </Button>
      {onToggleBranch ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={
                  expanded
                    ? `Collapse all in ${label}`
                    : `Expand all in ${label}`
                }
                onClick={onToggleBranch}
                className="size-5 shrink-0 text-dim hover:bg-transparent hover:text-ink"
              />
            }
          >
            {expanded ? (
              <ChevronsDownUp aria-hidden />
            ) : (
              <ChevronsUpDown aria-hidden />
            )}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {expanded ? "Collapse all" : "Expand all"}
          </TooltipContent>
        </Tooltip>
      ) : null}
      <NodeActions name={label} actions={actions} />
    </div>
  );
}

export default TreeRow;
