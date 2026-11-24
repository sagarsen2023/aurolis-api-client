import { useSetAtom } from "jotai";
import {
  FileWarning,
  FolderSearch,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  activeWorkspaceStateAtom,
  addWorkspaceOpenAtom,
} from "@/context/workspace-context";
import { useWorkspaceActions } from "@/hooks/use-workspaces";
import { usePromise } from "@/hooks/usePromise";
import { workspaceService } from "@/services/workspace.service";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";

function StatePanel({
  icon: Icon,
  title,
  description,
  children,
}: Readonly<{
  icon: typeof Sparkles;
  title: string;
  description: string;
  children?: React.ReactNode;
}>) {
  return (
    <div className="mx-auto flex w-full max-w-180 px-8 pt-16 pb-12">
      <Card className="w-full items-start gap-4 px-7 py-7">
        <span className="grid size-12 place-items-center rounded-full bg-surface-icon text-ink">
          <Icon className="size-5" strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <h1 className="text-[26px] leading-tight font-medium tracking-[-0.03em] text-foreground">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-[14px] text-mute">{description}</p>
        </div>
        {children ? (
          <div className="flex flex-wrap gap-3">{children}</div>
        ) : null}
      </Card>
    </div>
  );
}

export function NotAWorkspace({
  workspace,
}: Readonly<{ workspace: OpenedWorkspace }>) {
  const { openWorkspace } = useWorkspaceActions();
  const setActive = useSetAtom(activeWorkspaceStateAtom);
  const { loading, runPromise: initialize } = usePromise({
    promise: () => workspaceService.initialize(workspace.entry.id),
    onSuccessAsync: async (opened) => {
      setActive({ status: "ready", workspace: opened });
      toast.success("aurolis.json created. Commit it to share the workspace.");
      await openWorkspace(opened.entry.id, { quiet: true });
    },
  });

  return (
    <StatePanel
      icon={Sparkles}
      title="This repository isn't an Aurolis workspace yet"
      description={`Aurolis didn't find aurolis.json in ${workspace.displayPath}. Initialize it to start adding collections and environments here. Nothing else in the repository changes.`}
    >
      <Button
        size="lg"
        className="h-10 px-5 hover:bg-lav-hover"
        disabled={loading}
        onClick={() => void initialize()}
      >
        Initialize workspace
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="h-10 px-5"
        onClick={() => void workspaceService.reveal(workspace.entry.id)}
      >
        Show in folder
      </Button>
    </StatePanel>
  );
}

export function MissingWorkspace({
  workspaceId,
  message,
}: Readonly<{ workspaceId: string; message: string }>) {
  const { openActiveOrFirst } = useWorkspaceActions();
  const setAddOpen = useSetAtom(addWorkspaceOpenAtom);
  const { loading, runPromise: remove } = usePromise({
    promise: () => workspaceService.remove(workspaceId, false),
    onSuccessAsync: async () => {
      toast.success("Removed from Aurolis");
      await openActiveOrFirst();
    },
  });

  return (
    <StatePanel
      icon={FolderSearch}
      title="Workspace folder not found"
      description={`${message} If you moved it, open it again from its new location. Removing it from Aurolis doesn't delete anything.`}
    >
      <Button
        size="lg"
        className="h-10 px-5 hover:bg-lav-hover"
        onClick={() => setAddOpen(true)}
      >
        Open it again…
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="h-10 px-5"
        disabled={loading}
        onClick={() => void remove()}
      >
        Remove from Aurolis
      </Button>
    </StatePanel>
  );
}

export function WorkspaceLoadError({ message }: Readonly<{ message: string }>) {
  const { openActiveOrFirst } = useWorkspaceActions();
  return (
    <StatePanel
      icon={TriangleAlert}
      title="Couldn't open the workspace"
      description={message}
    >
      <Button
        variant="outline"
        size="lg"
        className="h-10 px-5"
        onClick={() => void openActiveOrFirst()}
      >
        Try again
      </Button>
    </StatePanel>
  );
}

export function FormatIssues({
  workspace,
}: Readonly<{ workspace: OpenedWorkspace }>) {
  if (workspace.issues.length === 0) return null;
  return (
    <Card className="gap-3 border-warn/40 px-5 py-5">
      <h2 className="flex items-center gap-2 text-[15px] text-foreground">
        <FileWarning
          className="size-4.5 text-warning"
          strokeWidth={1.8}
          aria-hidden
        />
        {workspace.issues.length === 1
          ? "1 file couldn't be read"
          : `${workspace.issues.length} files couldn't be read`}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {workspace.issues.slice(0, 8).map((issue) => (
          <li key={`${issue.path}-${issue.message}`} className="text-[13px]">
            <span className="font-mono text-foreground">{issue.path}</span>
            <span className="text-mute"> — {issue.message.split("\n")[0]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
