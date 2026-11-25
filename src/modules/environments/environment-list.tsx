import { Globe, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Environment } from "@/types/workspace/environment.type";
import { variableSummary } from "./variable-summary";

function EnvironmentRow({
  label,
  icon,
  detail,
  selected,
  inUse,
  isDefault,
  onSelect,
}: Readonly<{
  label: string;
  icon: typeof Globe;
  detail: string;
  selected: boolean;
  inUse?: boolean;
  isDefault?: boolean;
  onSelect: () => void;
}>) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-surface-selected text-ink"
          : "text-foreground hover:bg-surface-hover",
      )}
    >
      <Icon className="size-3.5 shrink-0 text-dim" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-[13px]">
          <span className="truncate">{label}</span>
          {inUse ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-success"
              title="In use"
            >
              <span className="sr-only">In use</span>
            </span>
          ) : null}
        </span>
        <span className="truncate text-[11.5px] text-dim">{detail}</span>
      </span>
      {isDefault ? (
        <span className="shrink-0 rounded-full border border-line px-1.5 text-[10.5px] text-mute">
          Default
        </span>
      ) : null}
    </button>
  );
}

function EnvironmentList({
  environments,
  globals,
  selectedId,
  inUseId,
  defaultId,
  onSelect,
  onCreate,
}: Readonly<{
  environments: Environment[];
  globals: Environment;
  selectedId: string | null;
  inUseId: string | null;
  defaultId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
}>) {
  return (
    <aside
      aria-label="Environments"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="text-[15px] font-medium text-foreground">
          Environments
        </h2>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New environment"
                onClick={onCreate}
              />
            }
          >
            <Plus />
          </TooltipTrigger>
          <TooltipContent side="bottom">New environment</TooltipContent>
        </Tooltip>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <nav
          aria-label="Environment list"
          className="flex flex-col gap-0.5 px-2 pb-4"
        >
          <EnvironmentRow
            label="Globals"
            icon={Globe}
            detail={variableSummary(globals.variables)}
            selected={selectedId === null}
            onSelect={() => onSelect(null)}
          />
          <div className="mx-2.5 my-2 border-t border-line" />
          {environments.map((environment) => (
            <EnvironmentRow
              key={environment.id}
              label={environment.name}
              icon={SlidersHorizontal}
              detail={variableSummary(environment.variables)}
              selected={selectedId === environment.id}
              inUse={inUseId === environment.id}
              isDefault={defaultId === environment.id}
              onSelect={() => onSelect(environment.id)}
            />
          ))}
          {environments.length === 0 ? (
            <div className="flex flex-col items-start gap-3 px-2.5 py-2">
              <p className="text-[13px] text-mute">
                No environments yet. Add one for each place you send requests
                to, like local, staging and production.
              </p>
              <Button variant="outline" size="sm" onClick={onCreate}>
                <Plus />
                New environment
              </Button>
            </div>
          ) : null}
        </nav>
      </ScrollArea>
    </aside>
  );
}

export default EnvironmentList;
