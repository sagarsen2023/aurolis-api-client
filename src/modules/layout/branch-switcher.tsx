import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Combobox } from "@base-ui/react/combobox";
import { toast } from "sonner";
import {
  CheckIcon,
  ChevronDown,
  Cloud,
  GitBranch,
  GitBranchPlus,
  Search,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { handleError } from "@/hooks/usePromise";
import { useWorkspaceActions } from "@/hooks/use-workspaces";
import { cn } from "@/lib/utils";
import { sourceControlService } from "@/services/source-control.service";
import type { BranchList } from "@/types/workspace/source-control.type";

type BranchItem = {
  kind: "local" | "remote" | "create";
  name: string;
};

type BranchGroup = { value: string; items: BranchItem[] };

const ITEM =
  "relative flex w-full cursor-default items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground";

function groupsFor(list: BranchList | null, query: string): BranchGroup[] {
  if (!list) return [];
  const typed = query.trim();
  const lower = typed.toLowerCase();
  const match = (name: string) => name.toLowerCase().includes(lower);
  const local = list.local.filter(match);
  const remote = list.remote.filter(match);
  const exists = [...list.local, ...list.remote].includes(typed);
  const groups: BranchGroup[] = [];
  if (local.length > 0) {
    groups.push({
      value: "Branches",
      items: local.map((name) => ({ kind: "local", name })),
    });
  }
  if (remote.length > 0) {
    groups.push({
      value: "On the remote",
      items: remote.map((name) => ({ kind: "remote", name })),
    });
  }
  if (typed && !exists) {
    groups.push({
      value: "New branch",
      items: [{ kind: "create", name: typed }],
    });
  }
  return groups;
}

function BranchSwitcher() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const { openWorkspace } = useWorkspaceActions();
  const [list, setList] = useState<BranchList | null>(null);
  const [query, setQuery] = useState("");
  const [fetching, setFetching] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const groups = useMemo(() => groupsFor(list, query), [list, query]);
  const workspaceId = workspace?.entry.id ?? null;
  const branch = workspace?.git.branch ?? null;

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    sourceControlService
      .branches(workspaceId, false)
      .then((next) => {
        if (active) setList(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [workspaceId, branch]);

  if (!workspace) return null;
  const id = workspace.entry.id;
  const current = workspace.git.branch;

  const load = async () => {
    try {
      if (!workspace.git.remoteUrl) {
        setList(await sourceControlService.branches(id, false));
        return;
      }
      setFetching(true);
      setList(await sourceControlService.branches(id, true));
    } catch (error) {
      handleError(error);
    } finally {
      setFetching(false);
    }
  };

  const choose = async (item: BranchItem | null) => {
    if (!item || item.name === current) return;
    setSwitching(item.name);
    try {
      const result = await sourceControlService.switchBranch({
        workspaceId: id,
        branch: item.name,
        create: item.kind === "create",
      });
      toast.success(
        result.created
          ? `Created and switched to ${result.branch}`
          : `Switched to ${result.branch}`,
        {
          description: result.created
            ? "It's pushed to the remote the next time you commit and sync."
            : undefined,
        },
      );
      await openWorkspace(id, { quiet: true });
    } catch (error) {
      handleError(error);
    } finally {
      setSwitching(null);
      setQuery("");
    }
  };

  return (
    <Combobox.Root<BranchItem>
      items={groups}
      value={null}
      filter={null}
      inputValue={query}
      autoHighlight
      itemToStringLabel={(item) => item.name}
      onInputValueChange={setQuery}
      onOpenChange={(open) => {
        if (open) void load();
        else setQuery("");
      }}
      onValueChange={(item) => void choose(item)}
    >
      <Combobox.Trigger
        aria-label={`Branch: ${current ?? "none"}. Switch branch`}
        disabled={switching !== null}
        className={cn(
          "flex h-10 max-w-56 items-center gap-2 rounded-full border border-input bg-card pr-3 pl-3.5 text-sm text-foreground transition-colors outline-none select-none",
          "hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/40 data-popup-open:bg-surface-hover data-disabled:opacity-60",
        )}
      >
        {switching ? (
          <Spinner className="size-4" />
        ) : (
          <GitBranch className="size-4 shrink-0 text-vio" aria-hidden />
        )}
        <span className="truncate font-mono text-[12.5px]">
          {switching ?? current ?? "No branch"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-dim" aria-hidden />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner
          sideOffset={6}
          align="end"
          className="isolate z-50 outline-none"
        >
          <Combobox.Popup
            className={cn(
              "flex max-h-[min(var(--available-height),26rem)] w-80 origin-(--transform-origin) flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-pop outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <div className="flex items-center gap-2 border-b border-line px-3.5">
              <Search className="size-4 shrink-0 text-dim" aria-hidden />
              <Combobox.Input
                aria-label="Find or create a branch"
                placeholder="Find or create a branch"
                spellCheck={false}
                className="h-11 min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-dim"
              />
              {fetching ? (
                <Spinner
                  className="size-3.5 text-dim"
                  aria-label="Fetching branches"
                />
              ) : null}
            </div>
            {list && groups.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-dim">
                No branches match.
              </p>
            ) : null}
            {!list ? (
              <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-dim">
                <Spinner className="size-4" />
                Loading branches
              </p>
            ) : null}
            <Combobox.List className="min-h-0 overflow-y-auto p-1 empty:p-0">
              {(group: BranchGroup) => (
                <Combobox.Group key={group.value} items={group.items}>
                  <Combobox.GroupLabel className="px-3 py-2 text-xs text-dim">
                    {group.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(item: BranchItem) => (
                      <Combobox.Item
                        key={`${item.kind}:${item.name}`}
                        value={item}
                        className={ITEM}
                      >
                        {item.kind === "create" ? (
                          <GitBranchPlus
                            className="size-4 shrink-0 text-vio"
                            aria-hidden
                          />
                        ) : item.kind === "remote" ? (
                          <Cloud
                            className="size-4 shrink-0 text-dim"
                            aria-hidden
                          />
                        ) : (
                          <GitBranch
                            className="size-4 shrink-0 text-dim"
                            aria-hidden
                          />
                        )}
                        <span className="min-w-0 truncate">
                          {item.kind === "create" ? (
                            <>
                              Create{" "}
                              <span className="font-mono text-[12.5px]">
                                {item.name}
                              </span>{" "}
                              from{" "}
                              <span className="font-mono text-[12.5px]">
                                {current ?? "HEAD"}
                              </span>
                            </>
                          ) : (
                            <span className="font-mono text-[12.5px]">
                              {item.name}
                            </span>
                          )}
                        </span>
                        {item.name === current && item.kind === "local" ? (
                          <CheckIcon
                            className="absolute right-2.5 size-4 text-vio"
                            aria-label="Current branch"
                          />
                        ) : null}
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
  );
}

export default BranchSwitcher;
