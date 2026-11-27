import { useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import RequestBadge from "@/modules/collections/shared/request-badge";
import {
  type LoadableRequest,
  useLoadableRequests,
} from "./use-loadable-requests";

type Group = { value: string; items: LoadableRequest[] };

function searchText(entry: LoadableRequest) {
  const method =
    entry.request.protocol === "http" ? entry.request.method : "graphql";
  return [entry.name, entry.path, entry.collection, method, entry.request.url]
    .join(" ")
    .toLowerCase();
}

function matches(entry: LoadableRequest, query: string) {
  const text = searchText(entry);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

function RequestPicker({
  value,
  disabled,
  error,
  onChange,
}: Readonly<{
  value: string | null;
  disabled?: boolean;
  error?: string;
  onChange: (id: string) => void;
}>) {
  const collections = useLoadableRequests();
  const groups = useMemo<Group[]>(
    () =>
      collections.map((group) => ({
        value: group.name,
        items: group.requests,
      })),
    [collections],
  );
  const selected =
    groups
      .flatMap((group) => group.items)
      .find((entry) => entry.id === value) ?? null;
  const empty = groups.length === 0;

  return (
    <div className="w-full">
      <Label className="mb-2" htmlFor="load-request">
        Request
      </Label>
      <Combobox.Root<LoadableRequest>
        items={groups}
        value={selected}
        disabled={disabled || empty}
        itemToStringLabel={(entry) => entry.name}
        isItemEqualToValue={(entry, current) => entry.id === current.id}
        filter={matches}
        autoHighlight
        onValueChange={(entry) => {
          if (entry) onChange(entry.id);
        }}
      >
        <Combobox.Trigger
          id="load-request"
          aria-invalid={error ? true : undefined}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-input bg-card px-4 text-sm text-foreground transition-colors outline-none select-none",
            "hover:bg-surface-hover focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
            "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
            "data-popup-open:bg-surface-hover data-disabled:cursor-not-allowed data-disabled:opacity-50",
          )}
        >
          {selected ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <RequestBadge request={selected.request} className="w-auto" />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="truncate text-dim">
              {empty ? "No HTTP or GraphQL requests" : "Choose a request"}
            </span>
          )}
          <ChevronDownIcon className="size-4 shrink-0 text-dim" aria-hidden />
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner
            sideOffset={6}
            align="start"
            className="isolate z-50 outline-none"
          >
            <Combobox.Popup
              className={cn(
                "flex max-h-[min(var(--available-height),26rem)] w-(--anchor-width) min-w-80 origin-(--transform-origin) flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-pop outline-none",
                "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              )}
            >
              <div className="flex items-center gap-2 border-b border-line px-3.5">
                <Search className="size-4 shrink-0 text-dim" aria-hidden />
                <Combobox.Input
                  aria-label="Search requests"
                  placeholder="Search by name, folder, method or URL"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
                />
              </div>
              <Combobox.Empty className="px-4 py-6 text-center text-sm text-dim empty:hidden">
                No requests match your search.
              </Combobox.Empty>
              <Combobox.List className="min-h-0 overflow-y-auto p-1 empty:p-0">
                {(group: Group) => (
                  <Combobox.Group
                    key={group.value}
                    items={group.items}
                    className="scroll-my-1"
                  >
                    <Combobox.GroupLabel className="px-3 py-2 text-xs text-dim">
                      {group.value}
                    </Combobox.GroupLabel>
                    <Combobox.Collection>
                      {(entry: LoadableRequest) => (
                        <Combobox.Item
                          key={entry.id}
                          value={entry}
                          className="relative flex w-full cursor-default items-baseline gap-2 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                        >
                          <RequestBadge request={entry.request} />
                          <span className="truncate">{entry.name}</span>
                          {entry.path ? (
                            <span className="truncate text-xs text-dim">
                              {entry.path}
                            </span>
                          ) : null}
                          <Combobox.ItemIndicator className="absolute right-2.5 flex size-4 items-center justify-center text-vio">
                            <CheckIcon className="size-4" />
                          </Combobox.ItemIndicator>
                        </Combobox.Item>
                      )}
                    </Combobox.Collection>
                  </Combobox.Group>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export default RequestPicker;
