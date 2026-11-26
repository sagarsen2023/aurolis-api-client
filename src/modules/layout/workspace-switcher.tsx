import { useAtomValue, useSetAtom } from "jotai";
import { ChevronDown, Plus, Settings } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  activeWorkspaceAtom,
  addWorkspaceOpenAtom,
  currentWorkspaceAtom,
  publishWorkspaceOpenAtom,
  registryAtom,
  workspaceSettingsOpenAtom,
} from "@/context/workspace-context";
import { useWorkspaceActions } from "@/hooks/use-workspaces";
import { getInitials } from "@/utils/extract-initials";
import { workspaceSubtitle } from "@/utils/workspace-subtitle";

export function WorkspaceTile({
  name,
  size = "md",
  className,
}: Readonly<{ name: string; size?: "sm" | "md"; className?: string }>) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center bg-lav font-semibold text-lav-ink",
        size === "md"
          ? "size-7 rounded-lg text-[11px]"
          : "size-5 rounded-md text-[9px]",
        className,
      )}
    >
      {getInitials({ name })}
    </span>
  );
}

function WorkspaceSwitcher() {
  const registry = useAtomValue(registryAtom);
  const current = useAtomValue(currentWorkspaceAtom);
  const setAddOpen = useSetAtom(addWorkspaceOpenAtom);
  const setPublishOpen = useSetAtom(publishWorkspaceOpenAtom);
  const setSettingsOpen = useSetAtom(workspaceSettingsOpenAtom);
  const active = useAtomValue(activeWorkspaceAtom);
  const canPublish = Boolean(active && !active.git.remoteUrl);
  const { openWorkspace } = useWorkspaceActions();
  const workspaces = registry?.workspaces ?? [];
  const label = current?.name ?? "No workspace";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-10 items-center gap-2.5 rounded-[12px] border border-input bg-card pr-3 pl-1.5 text-[15px] font-medium text-foreground transition-colors outline-none",
          "hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/40 data-popup-open:bg-surface-hover",
        )}
      >
        <WorkspaceTile name={label} />
        <span className="max-w-48 truncate">{label}</span>
        <ChevronDown className="size-4 text-dim" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-72">
        {workspaces.length > 0 ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={registry?.activeWorkspaceId ?? ""}
                onValueChange={(value) => {
                  if (value && value !== registry?.activeWorkspaceId) {
                    void openWorkspace(value as string);
                  }
                }}
              >
                {workspaces.map((workspace) => (
                  <DropdownMenuRadioItem
                    key={workspace.id}
                    value={workspace.id}
                  >
                    <WorkspaceTile name={workspace.name} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-foreground">
                        {workspace.name}
                      </span>
                      <span
                        className={cn(
                          "truncate text-xs",
                          workspace.missing ? "text-warning" : "text-dim",
                        )}
                      >
                        {workspaceSubtitle(workspace)}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={() => setAddOpen(true)}>
          <Plus />
          Add workspace…
        </DropdownMenuItem>
        {canPublish ? (
          <DropdownMenuItem onClick={() => setPublishOpen(true)}>
            <FaGithub />
            Publish to GitHub…
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          disabled={!active}
          onClick={() => setSettingsOpen(true)}
        >
          <Settings />
          Workspace settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WorkspaceSwitcher;
