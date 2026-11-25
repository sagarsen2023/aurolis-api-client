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
import ChangedFileRow from "./changed-file-row";
import DiffStat from "./diff-stat";

const OPEN_DIFFS_UP_TO = 3;
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

function totals(changes: SourceControlChanges) {
  return changes.files.reduce(
    (sum, file) => ({
      additions: sum.additions + file.additions,
      deletions: sum.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
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
  const { additions, deletions } = totals(changes);
  const count = changes.files.length + changes.truncatedFiles;
  return (
    <div className="flex items-center justify-between gap-2 text-[13px] text-mute">
      <span>
        {count} {count === 1 ? "file" : "files"} changed
        {changes.unpushedCommits > 0
          ? ` · ${changes.unpushedCommits} ${changes.unpushedCommits === 1 ? "commit" : "commits"} not pushed yet`
          : ""}
      </span>
      <DiffStat additions={additions} deletions={deletions} />
    </div>
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

  const fileCount = changes?.files.length ?? 0;
  const canCommit = fileCount > 0 && Boolean(message.trim()) && !committing;
  const canSyncOnly = fileCount === 0 && (changes?.unpushedCommits ?? 0) > 0;

  return (
    <form
      className="flex min-h-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canCommit) run(hasRemote);
      }}
    >
      <DialogHeader>
        <DialogTitle>Commit and sync</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <GitBranch className="size-3.5" aria-hidden />
            {changes?.branch ?? workspace.git.branch ?? "No branch"}
          </span>
          <span className="flex items-center gap-1.5">
            <CloudUpload className="size-3.5" aria-hidden />
            {hasRemote
              ? remoteLabel(workspace)
              : "No remote: commits stay on this computer"}
          </span>
        </DialogDescription>
      </DialogHeader>

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

      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          {changes ? <ChangesSummary changes={changes} /> : <span />}
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
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : null}
        {changes && fileCount === 0 ? (
          <p className="rounded-xl border border-line px-4 py-6 text-center text-[13px] text-mute">
            {canSyncOnly
              ? "Nothing new to commit. Your earlier commits are ready to push."
              : "Everything is committed and pushed."}
          </p>
        ) : null}
        {changes && fileCount > 0 ? (
          <ul className="flex max-h-[42vh] flex-col gap-2 overflow-y-auto pr-1">
            {changes.files.map((file) => (
              <ChangedFileRow
                key={`${file.status}:${file.path}`}
                file={file}
                defaultOpen={fileCount <= OPEN_DIFFS_UP_TO}
              />
            ))}
          </ul>
        ) : null}
        {changes && changes.truncatedFiles > 0 ? (
          <p className="text-[12px] text-mute">
            And {changes.truncatedFiles} more files, all included in the commit.
          </p>
        ) : null}
      </div>

      <DialogFooter className="items-center">
        <span className="mr-auto hidden text-[12px] text-dim sm:inline">
          {fileCount > 0
            ? `${MOD_KEY} Enter to ${hasRemote ? "commit and sync" : "commit"}`
            : null}
        </span>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        {fileCount > 0 && hasRemote ? (
          <Button
            type="button"
            variant="outline"
            disabled={!canCommit}
            onClick={() => run(false)}
          >
            <GitCommitHorizontal />
            Commit only
          </Button>
        ) : null}
        {canSyncOnly && hasRemote ? (
          <Button type="button" disabled={committing} onClick={() => run(true)}>
            <RefreshCw className={committing ? "animate-spin" : undefined} />
            Sync
          </Button>
        ) : (
          <Button type="submit" disabled={!canCommit}>
            {hasRemote ? (
              <RefreshCw className={committing ? "animate-spin" : undefined} />
            ) : (
              <GitCommitHorizontal />
            )}
            {hasRemote ? "Commit & sync" : "Commit"}
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
      <DialogContent className="max-h-[88vh] sm:max-w-3xl">
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
