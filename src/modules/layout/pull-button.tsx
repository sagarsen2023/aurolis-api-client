import { useState } from "react";
import { useAtomValue } from "jotai";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { pullLatest, useWorkspaceActions } from "@/hooks/use-workspaces";
import { cn } from "@/lib/utils";

function remoteLabel(
  github: { owner: string; repo: string } | null | undefined,
) {
  return github ? `${github.owner}/${github.repo}` : "the remote";
}

function PullButton() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const { openWorkspace } = useWorkspaceActions();
  const [pulling, setPulling] = useState(false);
  if (!workspace?.git.remoteUrl) return null;

  const id = workspace.entry.id;
  const remote = remoteLabel(workspace.entry.remote?.github);

  const pull = async () => {
    setPulling(true);
    try {
      const result = await pullLatest(id, workspace.entry.name, {
        announceUpToDate: true,
      });
      if (result) await openWorkspace(id, { quiet: true });
    } finally {
      setPulling(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={`Pull the latest changes from ${remote}`}
            disabled={pulling}
            className="rounded-full bg-card"
            onClick={() => void pull()}
          />
        }
      >
        <RefreshCw
          className={cn("size-4", pulling && "animate-spin")}
          aria-hidden
        />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {pulling
          ? "Pulling…"
          : `Pull the latest changes from ${remote}${workspace.git.branch ? ` (${workspace.git.branch})` : ""}`}
      </TooltipContent>
    </Tooltip>
  );
}

export default PullButton;
