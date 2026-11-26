import { useAtomValue, useSetAtom } from "jotai";
import { Cloud } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  activeWorkspaceAtom,
  commitDialogOpenAtom,
  publishWorkspaceOpenAtom,
} from "@/context/workspace-context";
import { cn } from "@/lib/utils";
import { unsavedCountAtom } from "@/context/collections-context";
import { useSaveRequests } from "@/hooks/use-request-drafts";
import { usePromise } from "@/hooks/usePromise";
import { MOD_KEY } from "@/utils/platform";
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

function UnsavedPill({ count }: Readonly<{ count: number }>) {
  const { saveAll } = useSaveRequests();
  const { loading, runPromise } = usePromise({ promise: saveAll });
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            className={cn(PILL, "h-auto hover:bg-surface-hover")}
            onClick={() => void runPromise()}
          />
        }
      >
        <span className="size-2 rounded-full bg-vio" aria-hidden />
        {plural(count, "unsaved request")}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Save all ({MOD_KEY} Shift S). Drafts are kept on this computer until you
        save them.
      </TooltipContent>
    </Tooltip>
  );
}

function SavePill() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const setPublishOpen = useSetAtom(publishWorkspaceOpenAtom);
  const unsaved = useAtomValue(unsavedCountAtom);
  const setCommitOpen = useSetAtom(commitDialogOpenAtom);
  if (!workspace) return null;
  if (unsaved > 0) return <UnsavedPill count={unsaved} />;

  if (!workspace.git.remoteUrl) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className={cn(PILL, "h-auto hover:bg-surface-hover")}
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
        render={
          detail ? (
            <Button
              type="button"
              variant="ghost"
              className={cn(PILL, "h-auto hover:bg-surface-hover")}
              onClick={() => setCommitOpen(true)}
            />
          ) : (
            <span role="status" tabIndex={0} className={PILL} />
          )
        }
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
        {detail ? "Commit & sync" : "All saved"}
        {workspace.git.changedFiles > 0 ? (
          <span className="rounded-full bg-warn px-1.5 text-[11px] leading-4 font-medium text-warn-foreground">
            {workspace.git.changedFiles}
          </span>
        ) : null}
        <span className="sr-only">{detail ? `: ${detail}` : null}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {detail
          ? `${detail}. Click to review, commit and sync.`
          : `Everything is committed and pushed to ${remoteName(workspace)}`}
      </TooltipContent>
    </Tooltip>
  );
}

export default SavePill;
