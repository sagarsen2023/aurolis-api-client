import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { CHANGE_STATUS } from "@/constants/source-control";
import { cn } from "@/lib/utils";
import type { ChangedFile } from "@/types/workspace/source-control.type";
import DiffStat from "./diff-stat";
import DiffView from "./diff-view";

function splitPath(filePath: string) {
  const index = filePath.lastIndexOf("/");
  if (index === -1) return { dir: "", name: filePath };
  return { dir: filePath.slice(0, index + 1), name: filePath.slice(index + 1) };
}

function ChangedFileRow({
  file,
  defaultOpen,
}: Readonly<{ file: ChangedFile; defaultOpen: boolean }>) {
  const [open, setOpen] = useState(defaultOpen);
  const status = CHANGE_STATUS[file.status];
  const Icon = status.icon;
  const { dir, name } = splitPath(file.path);

  return (
    <li className="overflow-hidden rounded-xl border border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2.5 bg-surface-raise/60 px-3 py-2 text-left outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-dim transition-transform",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <Icon className={cn("size-4 shrink-0", status.className)} aria-hidden />
        <span className="sr-only">{status.label}:</span>
        <span className="flex min-w-0 flex-1 items-baseline gap-0 font-mono text-[12.5px]">
          {file.oldPath ? (
            <span className="truncate text-dim">{file.oldPath} → </span>
          ) : null}
          <span className="truncate text-dim">{dir}</span>
          <span className="shrink-0 text-foreground">{name}</span>
        </span>
        <span
          className={cn(
            "font-mono text-[11px] font-semibold",
            status.className,
          )}
          title={status.label}
          aria-hidden
        >
          {status.letter}
        </span>
        <DiffStat additions={file.additions} deletions={file.deletions} />
      </button>
      {open ? (
        <div className="border-t border-line bg-background">
          <DiffView file={file} />
        </div>
      ) : null}
    </li>
  );
}

export default ChangedFileRow;
