import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleAlert,
  Eraser,
  PlugZap,
  Search,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import type {
  RealtimeEvent,
  RealtimeEventKind,
} from "@/types/engine/realtime-engine.type";
import { prettyJson } from "@/utils/json";
import JsonView from "../../shared/json-view";

type Direction = "all" | "incoming" | "outgoing";

const DIRECTIONS: ReadonlyArray<{ value: Direction; label: string }> = [
  { value: "all", label: "All" },
  { value: "incoming", label: "Received" },
  { value: "outgoing", label: "Sent" },
];

const KIND_STYLE: Record<
  RealtimeEventKind,
  { icon: typeof ArrowUpRight; className: string; label: string }
> = {
  outgoing: { icon: ArrowUpRight, className: "text-vio", label: "Sent" },
  incoming: {
    icon: ArrowDownLeft,
    className: "text-success",
    label: "Received",
  },
  open: { icon: PlugZap, className: "text-dim", label: "Connected" },
  close: { icon: Unplug, className: "text-dim", label: "Disconnected" },
  error: { icon: CircleAlert, className: "text-destructive", label: "Error" },
};

function formatTime(at: number) {
  const date = new Date(at);
  const time = date.toLocaleTimeString([], { hour12: false });
  return `${time}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

function isVisible(event: RealtimeEvent, direction: Direction, query: string) {
  if (direction !== "all" && event.kind !== direction) return false;
  if (!query) return true;
  const haystack = `${event.event ?? ""} ${event.data}`.toLowerCase();
  return haystack.includes(query);
}

function EventRow({ event }: Readonly<{ event: RealtimeEvent }>) {
  const style = KIND_STYLE[event.kind];
  const Icon = style.icon;
  const isMessage = event.kind === "incoming" || event.kind === "outgoing";
  const pretty = isMessage ? prettyJson(event.data) : null;
  return (
    <li className="flex gap-3 border-b border-line/60 px-5 py-2">
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", style.className)}
        aria-label={style.label}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-[11.5px] text-dim">
          <time dateTime={new Date(event.at).toISOString()}>
            {formatTime(event.at)}
          </time>
          {event.event ? (
            <Pill variant="outline" className="h-5 font-mono text-[11px]">
              {event.event}
            </Pill>
          ) : null}
        </div>
        {pretty ? (
          <JsonView text={pretty} className="max-h-64 overflow-auto" />
        ) : (
          <pre
            className={cn(
              "max-h-64 overflow-auto font-mono text-[12.5px] break-all whitespace-pre-wrap",
              isMessage ? "text-code" : style.className,
            )}
          >
            {event.data}
          </pre>
        )}
      </div>
    </li>
  );
}

function MessageLog({
  events,
  onClear,
}: Readonly<{ events: RealtimeEvent[]; onClear: () => void }>) {
  const [direction, setDirection] = useState<Direction>("all");
  const [query, setQuery] = useState("");
  const bottom = useRef<HTMLLIElement>(null);
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(
    () => events.filter((event) => isVisible(event, direction, normalized)),
    [events, direction, normalized],
  );

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [visible.length]);

  return (
    <section aria-label="Messages" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2">
        <div role="group" aria-label="Direction" className="flex gap-1">
          {DIRECTIONS.map((option) => (
            <Button
              key={option.value}
              size="xs"
              variant={direction === option.value ? "secondary" : "ghost"}
              aria-pressed={direction === option.value}
              onClick={() => setDirection(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <label className="ml-auto flex h-7 items-center gap-1.5 rounded-full border border-input bg-input/30 px-2.5 focus-within:border-ring">
          <Search className="size-3.5 text-dim" aria-hidden />
          <input
            aria-label="Filter messages"
            placeholder="Filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-36 bg-transparent text-[12.5px] outline-none placeholder:text-dim"
          />
        </label>
        <Button
          size="xs"
          variant="ghost"
          disabled={events.length === 0}
          onClick={onClear}
        >
          <Eraser />
          Clear
        </Button>
      </div>
      {events.length === 0 ? (
        <Empty className="flex-1 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlugZap />
            </EmptyMedia>
            <EmptyTitle>No messages yet</EmptyTitle>
            <EmptyDescription>
              Connect, then send a message. Everything sent and received shows
              up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol aria-live="polite" className="min-h-0 flex-1 overflow-auto">
          {visible.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
          <li ref={bottom} aria-hidden className="h-px" />
        </ol>
      )}
    </section>
  );
}

export default MessageLog;
