import { SlidersHorizontal } from "lucide-react";
import { CHANGE_STATUS } from "@/constants/source-control";
import { IMPORT_SAMPLES } from "@/constants/import-export";
import { cn } from "@/lib/utils";
import RequestBadge from "@/modules/collections/shared/request-badge";
import type { HttpMethod } from "@/types/workspace/request.type";

const IMPORTED_REQUESTS: { name: string; method: HttpMethod }[] = [
  { name: "Create payment", method: "POST" },
  { name: "List payments", method: "GET" },
  { name: "Refund payment", method: "DELETE" },
];

const CONNECTOR_Y = [20, 72, 124];

function AddedMark() {
  const added = CHANGE_STATUS.added;
  return (
    <span
      className={cn(
        "ml-auto font-mono text-[11px] font-semibold",
        added.className,
      )}
      title={added.label}
    >
      {added.letter}
    </span>
  );
}

function Connectors() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 56 144"
      className="h-36 w-14 shrink-0 text-line-strong"
      fill="none"
    >
      {CONNECTOR_Y.map((y) => (
        <path
          key={y}
          d={`M0 ${y} C 28 ${y}, 28 72, 56 72`}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="motion-safe:animate-dash-flow"
        />
      ))}
      <circle cx="53" cy="72" r="3" className="fill-vio" />
    </svg>
  );
}

function ImportPreview() {
  return (
    <div aria-hidden className="flex items-center select-none">
      <ul className="flex w-52 shrink-0 flex-col gap-3">
        {IMPORT_SAMPLES.map(({ file, icon: Icon }, index) => (
          <li
            key={file}
            style={{ animationDelay: `${index * 90}ms` }}
            className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-panel px-3 font-mono text-[11px] text-mute shadow-xs motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-left-2"
          >
            <Icon className="size-3.5 shrink-0 text-dim" />
            <span className="truncate">{file}</span>
          </li>
        ))}
      </ul>
      <Connectors />
      <div className="w-60 shrink-0 rounded-2xl border border-line bg-surface-panel p-3 shadow-pop">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-[12.5px] font-medium text-foreground">
            Payments API
          </span>
          <span className="rounded-full bg-ok px-1.5 text-[10.5px] leading-4 font-medium text-ok-foreground">
            4 added
          </span>
        </div>
        <ul className="flex flex-col">
          {IMPORTED_REQUESTS.map((request, index) => (
            <li
              key={request.name}
              style={{ animationDelay: `${300 + index * 120}ms` }}
              className="flex h-8 items-center gap-1 rounded-lg px-1 text-[12.5px] text-foreground motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
            >
              <RequestBadge
                request={{ protocol: "http", method: request.method }}
              />
              <span className="truncate">{request.name}</span>
              <AddedMark />
            </li>
          ))}
          <li
            style={{ animationDelay: "660ms" }}
            className="mt-1 flex h-8 items-center gap-2 rounded-lg border-t border-line px-1 pt-1 text-[12.5px] text-foreground motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
          >
            <SlidersHorizontal className="size-3.5 text-dim" />
            <span className="truncate">Staging</span>
            <span className="text-[11px] text-dim">environment</span>
            <AddedMark />
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ImportPreview;
