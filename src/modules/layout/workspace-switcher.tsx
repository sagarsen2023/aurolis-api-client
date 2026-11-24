import { useAtom, useAtomValue } from "jotai";
import { ChevronDown, Plus, Settings } from "lucide-react";
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
import { WORKSPACES } from "@/constants/workspaces";
import {
  currentWorkspaceAtom,
  workspaceIdAtom,
} from "@/context/workspace-context";
import { getInitials } from "@/utils/extract-initials";

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

/** Static for now: switching only changes local state. */
function WorkspaceSwitcher() {
  const [workspaceId, setWorkspaceId] = useAtom(workspaceIdAtom);
  const workspace = useAtomValue(currentWorkspaceAtom);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-10 items-center gap-2.5 rounded-[12px] border border-input bg-card pr-3 pl-1.5 text-[15px] font-medium text-foreground transition-colors outline-none",
          "hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/40 data-popup-open:bg-surface-hover",
        )}
      >
        <WorkspaceTile name={workspace.name} />
        <span className="max-w-48 truncate">{workspace.name}</span>
        <ChevronDown className="size-4 text-dim" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={workspaceId}
            onValueChange={(value) => setWorkspaceId(value as string)}
          >
            {WORKSPACES.map((w) => (
              <DropdownMenuRadioItem key={w.id} value={w.id}>
                <WorkspaceTile name={w.name} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-foreground">{w.name}</span>
                  <span className="text-xs text-dim">{w.plan}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus />
          Create workspace
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Workspace settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WorkspaceSwitcher;
