import { useState, type FormEvent } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { GitBranch, HardDrive } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
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
import { NameField } from "@/components/name-field";
import {
  activeWorkspaceAtom,
  activeWorkspaceStateAtom,
  publishWorkspaceOpenAtom,
  registryAtom,
  workspaceSettingsOpenAtom,
} from "@/context/workspace-context";
import { usePromise } from "@/hooks/usePromise";
import { workspaceService } from "@/services/workspace.service";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import { nameError } from "@/utils/name";

function remoteLabel(workspace: OpenedWorkspace) {
  const github = workspace.entry.remote?.github;
  if (github) return `${github.owner}/${github.repo}`;
  return (workspace.git.remoteUrl ?? "").replace(/^https?:\/\//, "");
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function SyncStatus({
  workspace,
  onPublish,
}: Readonly<{ workspace: OpenedWorkspace; onPublish: () => void }>) {
  const setActive = useSetAtom(activeWorkspaceStateAtom);
  const setRegistry = useSetAtom(registryAtom);
  const [confirming, setConfirming] = useState(false);
  const synced = Boolean(workspace.git.remoteUrl);
  const isGithub = Boolean(workspace.entry.remote?.github);
  const unpushed = workspace.git.unpushedCommits;

  const { loading, runPromise: stopSyncing } = usePromise({
    promise: () => workspaceService.stopSync(workspace.entry.id),
    onSuccessAsync: async (opened) => {
      setActive({ status: "ready", workspace: opened });
      setRegistry(await workspaceService.list());
      setConfirming(false);
      toast.success("Stopped syncing. This workspace is local now.");
    },
  });

  return (
    <section
      aria-labelledby="workspace-sync-title"
      className="flex flex-col gap-2"
    >
      <h3
        id="workspace-sync-title"
        className="text-[13px] font-medium text-foreground"
      >
        Sync
      </h3>
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-icon text-ink">
            {isGithub ? (
              <FaGithub className="size-4" aria-hidden />
            ) : synced ? (
              <GitBranch className="size-4" strokeWidth={1.8} aria-hidden />
            ) : (
              <HardDrive className="size-4" strokeWidth={1.8} aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] text-foreground">
              {synced ? remoteLabel(workspace) : "Local only"}
            </p>
            <p className="text-[13px] text-mute">
              {synced
                ? `Synced with ${isGithub ? "GitHub" : "its remote"}${workspace.git.branch ? ` on ${workspace.git.branch}` : ""}`
                : "Saved only on this computer"}
            </p>
          </div>
          {synced ? (
            confirming ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirming(true)}
              >
                Stop syncing
              </Button>
            )
          ) : (
            <Button type="button" size="sm" onClick={onPublish}>
              <FaGithub />
              Publish to GitHub
            </Button>
          )}
        </div>
        {confirming ? (
          <div
            role="alert"
            className="flex flex-col gap-3 border-t border-line pt-3"
          >
            <p className="text-[13px] leading-relaxed text-mute">
              Aurolis removes the link to {remoteLabel(workspace)}. Your files
              and history stay on this computer, and nothing changes on the
              remote.
              {unpushed > 0
                ? ` ${plural(unpushed, "commit")} that ${unpushed === 1 ? "hasn't" : "haven't"} been pushed will stay only here.`
                : ""}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                Keep syncing
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={loading}
                onClick={() => void stopSyncing()}
              >
                Stop syncing
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SettingsForm({
  workspace,
  onClose,
  onPublish,
}: Readonly<{
  workspace: OpenedWorkspace;
  onClose: () => void;
  onPublish: () => void;
}>) {
  const registry = useAtomValue(registryAtom);
  const setRegistry = useSetAtom(registryAtom);
  const current =
    registry?.workspaces.find((item) => item.id === workspace.entry.id)?.name ??
    workspace.entry.name;
  const [name, setName] = useState(current);
  const changed = name.trim() !== current;

  const { loading, runPromise: rename } = usePromise({
    promise: () => workspaceService.rename(workspace.entry.id, name.trim()),
    onSuccess: (view) => {
      setRegistry(view);
      toast.success("Workspace renamed");
      onClose();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!changed) {
      onClose();
      return;
    }
    if (!nameError(name) && !loading) void rename();
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Workspace settings</DialogTitle>
        <DialogDescription>{workspace.displayPath}</DialogDescription>
      </DialogHeader>
      <NameField
        name={name}
        setName={setName}
        touched={name !== current}
        label="Name"
        placeholder="Payments API"
      />
      <SyncStatus workspace={workspace} onPublish={onPublish} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={Boolean(nameError(name)) || loading}>
          {changed ? "Save" : "Done"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function WorkspaceSettingsDialog() {
  const [open, setOpen] = useAtom(workspaceSettingsOpenAtom);
  const setPublishOpen = useSetAtom(publishWorkspaceOpenAtom);
  const workspace = useAtomValue(activeWorkspaceAtom);
  if (!open || !workspace) return null;

  const close = () => setOpen(false);
  return (
    <Dialog open onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className="sm:max-w-lg">
        <SettingsForm
          workspace={workspace}
          onClose={close}
          onPublish={() => {
            close();
            setPublishOpen(true);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default WorkspaceSettingsDialog;
