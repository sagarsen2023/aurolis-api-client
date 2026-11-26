import { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  CloudUpload,
  GitBranch,
  GitCommitHorizontal,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { unsavedCountAtom } from "@/context/collections-context";
import {
  activeWorkspaceAtom,
  commitDialogOpenAtom,
} from "@/context/workspace-context";
import { useSaveRequests } from "@/hooks/use-request-drafts";
import { useWorkspaceActions } from "@/hooks/use-workspaces";
import { usePromise } from "@/hooks/usePromise";
import { WorkspaceFailure } from "@/services/workspace.service";
import { sourceControlService } from "@/services/source-control.service";
import type {
  CommitResult,
  SourceControlChanges,
} from "@/types/workspace/source-control.type";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import { isModEnter, MOD_KEY } from "@/utils/platform";
import ChangeGroup from "./change-group";

const COMMIT_KEEPING_CODES = new Set([
  "sync_failed",
  "merge_conflict",
  "protected_branch",
  "push_rejected",
]);

function remoteLabel(workspace: OpenedWorkspace) {
  const github = workspace.entry.remote?.github;
  if (github) return `${github.owner}/${github.repo}`;
  return workspace.git.remoteUrl ?? "origin";
}

function successMessage(result: CommitResult) {
  if (result.pushed && result.pulled) {
    return result.committed
      ? "Committed, brought in the latest changes and pushed"
      : "Brought in the latest changes and pushed";
  }
  if (result.pushed)
    return result.committed ? "Committed and pushed" : "Pushed";
  return "Committed on this computer";
}

function UnsavedNotice({ count }: Readonly<{ count: number }>) {
  const { saveAll } = useSaveRequests();
  const { loading, runPromise } = usePromise({ promise: saveAll });
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-warn/15 px-3 py-2 text-[13px] text-foreground">
      <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
      <span className="flex-1">
        {count} {count === 1 ? "request has" : "requests have"} unsaved changes,
        which aren't part of this commit.
      </span>
      <Button
        size="xs"
        variant="outline"
        disabled={loading}
        onClick={() => void runPromise()}
      >
        Save all
      </Button>
    </div>
  );
}

function ChangesSummary({
  changes,
}: Readonly<{ changes: SourceControlChanges }>) {
  const unpushed = changes.unpushedCommits;
  if (unpushed === 0) return null;
  return (
    <span className="truncate text-[12px] text-dim">
      {unpushed} {unpushed === 1 ? "commit" : "commits"} not pushed
    </span>
  );
}

function CommitForm({
  workspace,
  onClose,
}: Readonly<{ workspace: OpenedWorkspace; onClose: () => void }>) {
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [changes, setChanges] = useState<SourceControlChanges | null>(null);
  const unsaved = useAtomValue(unsavedCountAtom);
  const { openWorkspace } = useWorkspaceActions();
  const workspaceId = workspace.entry.id;
  const hasRemote = Boolean(workspace.git.remoteUrl);

  const { loading: loadingChanges, runPromise: loadChanges } = usePromise({
    initialLoading: true,
    promise: () => sourceControlService.changes(workspaceId),
    onSuccess: setChanges,
  });

  useEffect(() => {
    void loadChanges();
  }, [loadChanges, unsaved]);

  const syncRequested = useRef(false);
  const { loading: committing, runPromise: commit } = usePromise({
    showErrorToast: false,
    promise: () =>
      sourceControlService.commit({
        workspaceId,
        message: message.trim() || "Sync",
        sync: syncRequested.current,
      }),
    onSuccessAsync: async (result) => {
      toast.success(successMessage(result));
      onClose();
      await openWorkspace(workspaceId, { quiet: true });
    },
    onErrorAsync: async (error) => {
      setFailure(error.message);
      if (
        error instanceof WorkspaceFailure &&
        COMMIT_KEEPING_CODES.has(error.code)
      ) {
        setMessage("");
        await loadChanges();
        await openWorkspace(workspaceId, { quiet: true });
      }
    },
  });

  const run = (sync: boolean) => {
    setFailure(null);
    syncRequested.current = sync;
    void commit();
  };

  const fileCount = changes?.fileCount ?? 0;
  const canCommit = fileCount > 0 && Boolean(message.trim()) && !committing;
  const canSyncOnly = fileCount === 0 && (changes?.unpushedCommits ?? 0) > 0;

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (canCommit) run(hasRemote);
      }}
    >
      <DialogHeader className="gap-3 px-6 pt-6 pr-14 pb-4">
        <DialogTitle className="text-[17px]">Commit and sync</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-raise px-2.5 py-1 text-[12px] text-foreground">
            <GitBranch className="size-3.5 text-dim" aria-hidden />
            {changes?.branch ?? workspace.git.branch ?? "No branch"}
          </span>
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface-raise px-2.5 py-1 text-[12px] text-foreground">
            <CloudUpload className="size-3.5 shrink-0 text-dim" aria-hidden />
            <span className="truncate">
              {hasRemote
                ? remoteLabel(workspace)
                : "Commits stay on this computer"}
            </span>
          </span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-5">
        <UnsavedNotice count={unsaved} />

        {fileCount > 0 ? (
          <Textarea
            id="commit-message"
            label="Commit message"
            autoFocus
            rows={3}
            maxLength={10_000}
            value={message}
            placeholder="Describe what changed, e.g. Add refund requests"
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (!isModEnter(event)) return;
              event.preventDefault();
              if (canCommit) run(hasRemote);
            }}
            className="min-h-24 bg-surface-2 text-[13px] focus-visible:ring-2"
          />
        ) : null}

        {failure ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="whitespace-pre-wrap">{failure}</span>
          </p>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <h3 className="text-[13px] font-medium text-foreground">
                Changes
              </h3>
              {changes ? <ChangesSummary changes={changes} /> : null}
            </div>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Refresh changes"
              disabled={loadingChanges}
              onClick={() => void loadChanges()}
            >
              <RefreshCw
                className={loadingChanges ? "animate-spin" : undefined}
              />
            </Button>
          </div>
          {loadingChanges && !changes ? (
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : null}
          {changes && fileCount === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-mute">
              {canSyncOnly
                ? "Nothing new to commit. Your earlier commits are ready to push."
                : "Everything is committed and pushed."}
            </p>
          ) : null}
          {changes && fileCount > 0 ? (
            <ul className="max-h-[40vh] divide-y divide-line overflow-y-auto">
              {changes.groups.map((group) => (
                <ChangeGroup key={group.key} group={group} />
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <DialogFooter className="items-center border-t border-line bg-surface-raise/40 px-6 py-4">
        <span className="mr-auto hidden items-center gap-1.5 text-[12px] text-dim sm:inline-flex">
          {fileCount > 0 ? (
            <>
              <Kbd>{MOD_KEY}</Kbd>
              <Kbd>Enter</Kbd>
              <span>{hasRemote ? "commit and sync" : "commit"}</span>
            </>
          ) : null}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        {fileCount > 0 && hasRemote ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCommit}
            onClick={() => run(false)}
          >
            <GitCommitHorizontal />
            Commit only
          </Button>
        ) : null}
        {canSyncOnly && hasRemote ? (
          <Button
            type="button"
            size="sm"
            disabled={committing}
            onClick={() => run(true)}
          >
            <RefreshCw className={committing ? "animate-spin" : undefined} />
            Sync
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!canCommit}>
            {hasRemote ? (
              <RefreshCw className={committing ? "animate-spin" : undefined} />
            ) : (
              <GitCommitHorizontal />
            )}
            {hasRemote ? "Commit and sync" : "Commit"}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

function CommitDialog() {
  const [open, setOpen] = useAtom(commitDialogOpenAtom);
  const workspace = useAtomValue(activeWorkspaceAtom);
  const close = () => setOpen(false);

  return (
    <Dialog
      open={open && Boolean(workspace)}
      onOpenChange={(next) => (next ? null : close())}
    >
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {workspace ? (
          <CommitForm
            key={workspace.entry.id}
            workspace={workspace}
            onClose={close}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default CommitDialog;
