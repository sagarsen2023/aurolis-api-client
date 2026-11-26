import { useState } from "react";
import { useAtom } from "jotai";
import { Check, FolderOpen, HardDrive, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { STORAGE_WARNING_MESSAGES } from "@/constants/workspace";
import { registryAtom } from "@/context/workspace-context";
import { usePromise } from "@/hooks/usePromise";
import { cn } from "@/lib/utils";
import { workspaceService } from "@/services/workspace.service";
import type { StorageFolderCheck } from "@/types/workspace/workspace-store.type";
import { formatFreeSpace } from "@/utils/format-bytes";

type StorageChoice = "default" | "chosen";

function ChoiceCard({
  selected,
  title,
  check,
  placeholder,
  onSelect,
  icon: Icon,
}: Readonly<{
  selected: boolean;
  title: string;
  check: StorageFolderCheck | null;
  placeholder: string;
  onSelect: () => void;
  icon: typeof HardDrive;
}>) {
  const free = check ? formatFreeSpace(check.freeBytes) : null;
  return (
    <Button
      type="button"
      variant="ghost"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "h-auto w-full items-start justify-start font-normal whitespace-normal hover:bg-transparent",
        "flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected ? "border-vio" : "border-line hover:bg-surface-raise",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-icon text-ink">
        <Icon className="size-4.5" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] text-foreground">{title}</span>
        <span className="truncate font-mono text-[13px] text-mute">
          {check?.displayPath ?? placeholder}
        </span>
        {free ? <span className="text-[12.5px] text-dim">{free}</span> : null}
      </span>
      <span
        className={cn(
          "mt-1 grid size-5 shrink-0 place-items-center rounded-full border",
          selected ? "border-vio bg-vio text-white" : "border-line",
        )}
        aria-hidden
      >
        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
    </Button>
  );
}

function StorageStep({
  variant = "page",
}: Readonly<{ variant?: "page" | "sheet" }>) {
  const [registry, setRegistry] = useAtom(registryAtom);
  const [choice, setChoice] = useState<StorageChoice>("default");
  const [chosen, setChosen] = useState<StorageFolderCheck | null>(null);

  const { loading: picking, runPromise: pickFolder } = usePromise({
    promise: () => workspaceService.chooseStorage(),
    onSuccess: (check) => {
      if (!check) return;
      setChosen(check);
      setChoice("chosen");
    },
  });

  const { loading: saving, runPromise: save } = usePromise({
    promise: () => workspaceService.setStorage(choice),
    onSuccess: (view) => {
      setRegistry(view);
      toast.success(
        `Workspaces will be saved in ${view.storageFolderDisplay ?? "the chosen folder"}`,
      );
    },
  });

  if (!registry) return null;

  const fallback = registry.defaultStorageFolder;
  const selected = choice === "chosen" ? chosen : fallback;
  const blocked = !selected || Boolean(selected.error) || !selected.writable;

  return (
    <Card className={cn("gap-5 px-6 py-6", variant === "sheet" && "gap-4")}>
      <div>
        <h2 className="text-xl font-medium tracking-[-0.01em] text-foreground">
          Where should Aurolis store your workspaces?
        </h2>
        <p className="text-[13.5px] text-mute">
          Each workspace is a normal git folder inside this one, so you can back
          it up or open it in other tools. You can change this later; it only
          affects new workspaces.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Storage folder"
        className={cn("grid gap-3", variant === "page" && "md:grid-cols-2")}
      >
        <ChoiceCard
          icon={HardDrive}
          title="Recommended"
          check={fallback}
          placeholder={fallback.displayPath}
          selected={choice === "default"}
          onSelect={() => setChoice("default")}
        />
        <ChoiceCard
          icon={FolderOpen}
          title="Another folder"
          check={chosen}
          placeholder="Pick a folder on this computer…"
          selected={choice === "chosen"}
          onSelect={() => {
            if (chosen) setChoice("chosen");
            else void pickFolder();
          }}
        />
      </div>

      {selected?.error ? (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {selected.error}
        </p>
      ) : null}
      {selected?.error
        ? null
        : selected?.warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 rounded-lg bg-warn/15 px-3 py-2 text-[13px] text-foreground"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden
              />
              {STORAGE_WARNING_MESSAGES[warning]}
            </p>
          ))}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {chosen ? (
          <Button
            variant="ghost"
            disabled={picking}
            onClick={() => void pickFolder()}
          >
            Choose a different folder…
          </Button>
        ) : null}
        <Button disabled={blocked || saving} onClick={() => void save()}>
          Continue
        </Button>
      </div>
    </Card>
  );
}

export default StorageStep;
