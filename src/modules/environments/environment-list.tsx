import { useAtomValue } from "jotai";
import { Globe, Layers, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { environmentDraftsAtom } from "@/context/environments-context";
import type { Environment } from "@/types/workspace/environment.type";
import { variableSummary } from "./variable-summary";

function EnvironmentItem({
  environment,
  isGlobals,
  selected,
  dirty,
  active,
  isDefault,
  onSelect,
}: Readonly<{
  environment: Environment;
  isGlobals: boolean;
  selected: boolean;
  dirty: boolean;
  active: boolean;
  isDefault: boolean;
  onSelect: () => void;
}>) {
  const Icon = isGlobals ? Globe : Layers;
  return (
    <Card
      displayGradient={selected}
      className="gap-0 rounded-2xl py-0 transition-colors hover:border-line-strong"
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="h-auto w-full justify-start gap-2.5 rounded-2xl px-3.5 py-3 text-left font-normal whitespace-normal hover:bg-transparent"
      >
        <span className="grid size-9.5 shrink-0 place-items-center rounded-full bg-surface-icon text-ink">
          <Icon className="size-4.5" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
            <span className="truncate">{environment.name}</span>
            {isDefault ? (
              <span title="Default environment" className="text-warning">
                <Star className="size-3 fill-current" aria-hidden />
                <span className="sr-only">Default</span>
              </span>
            ) : null}
            {dirty ? (
              <span
                title="Unsaved changes"
                className="size-1.5 shrink-0 rounded-full bg-coral"
              >
                <span className="sr-only">Unsaved changes</span>
              </span>
            ) : null}
          </span>
          <span className="truncate text-[12.5px] text-dim">
            {variableSummary(environment.variables)}
          </span>
        </span>
        {active ? <Pill variant="ok">Active</Pill> : null}
      </Button>
    </Card>
  );
}

function EnvironmentList({
  environments,
  globals,
  selectedId,
  activeId,
  defaultId,
  onSelect,
}: Readonly<{
  environments: Environment[];
  globals: Environment;
  selectedId: string;
  activeId: string | null;
  defaultId: string | null;
  onSelect: (id: string) => void;
}>) {
  const drafts = useAtomValue(environmentDraftsAtom);
  return (
    <nav aria-label="Environments" className="flex flex-col gap-2">
      {environments.map((environment) => (
        <EnvironmentItem
          key={environment.id}
          environment={environment}
          isGlobals={false}
          selected={selectedId === environment.id}
          dirty={environment.id in drafts}
          active={activeId === environment.id}
          isDefault={defaultId === environment.id}
          onSelect={() => onSelect(environment.id)}
        />
      ))}
      {environments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-3.5 text-[13px] text-mute">
          No environments yet. Add one for each place you send requests to, like
          local, staging and production.
        </p>
      ) : null}
      <EnvironmentItem
        environment={globals}
        isGlobals
        selected={selectedId === globals.id}
        dirty={globals.id in drafts}
        active={false}
        isDefault={false}
        onSelect={() => onSelect(globals.id)}
      />
    </nav>
  );
}

export default EnvironmentList;
