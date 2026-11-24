import { useAtomValue, useSetAtom } from "jotai";
import { Cloud } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  activeWorkspaceAtom,
  publishWorkspaceOpenAtom,
} from "@/context/workspace-context";
import { cn } from "@/lib/utils";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";

const PILL =
  "inline-flex h-10 items-center gap-2 rounded-full border border-input bg-card px-4 text-sm text-foreground";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function syncDetail({ git }: OpenedWorkspace) {
  const parts = [
    git.changedFiles > 0
      ? plural(git.changedFiles, "uncommitted change")
      : null,
    git.unpushedCommits > 0
      ? `${plural(git.unpushedCommits, "commit")} not pushed`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function remoteName(workspace: OpenedWorkspace) {
  const github = workspace.entry.remote?.github;
  if (github) return `${github.owner}/${github.repo}`;
  return (workspace.git.remoteUrl ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "");
}

function SavePill() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const setPublishOpen = useSetAtom(publishWorkspaceOpenAtom);
  if (!workspace) return null;

  if (!workspace.git.remoteUrl) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className={cn(
                PILL,
                "transition-colors outline-none hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/40",
              )}
              onClick={() => setPublishOpen(true)}
            />
          }
        >
          <FaGithub className="size-4" aria-hidden />
          Publish on GitHub
        </TooltipTrigger>
        <TooltipContent side="bottom">
          This workspace is only on this computer
        </TooltipContent>
      </Tooltip>
    );
  }

  const detail = syncDetail(workspace);
  const Icon = workspace.entry.remote?.github ? FaGithub : Cloud;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span role="status" tabIndex={0} className={PILL} />}
      >
        <span className="relative">
          <Icon className="size-4" aria-hidden />
          <span
            aria-hidden
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-card",
              detail ? "bg-warning" : "bg-success",
            )}
          />
        </span>
        {detail ? "Not synced" : "All saved"}
        <span className="sr-only">{detail ? `: ${detail}` : null}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {detail ??
          `Everything is committed and pushed to ${remoteName(workspace)}`}
      </TooltipContent>
    </Tooltip>
  );
}

export default SavePill;
