import { useState, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import { FolderGit2, FolderPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { githubUserAtom } from "@/context/auth-context";
import { registryAtom } from "@/context/workspace-context";
import { useWorkspaceActions } from "@/hooks/use-workspaces";
import { usePromise } from "@/hooks/usePromise";
import { cn } from "@/lib/utils";
import {
  WorkspaceFailure,
  workspaceService,
} from "@/services/workspace.service";
import ClonePanel from "./clone-panel";
import StorageFolderLine from "./storage-folder-line";
import StorageStep from "./storage-step";

function Option({
  icon: Icon,
  title,
  description,
  children,
}: Readonly<{
  icon: typeof Plus;
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-icon text-ink">
          <Icon className="size-4.5" strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <h3 className="text-[15px] text-foreground">{title}</h3>
          <p className="text-[13px] text-mute">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function GetStarted({
  variant = "page",
  onDone,
}: Readonly<{ variant?: "page" | "sheet"; onDone?: () => void }>) {
  const user = useAtomValue(githubUserAtom);
  const registry = useAtomValue(registryAtom);
  const { openWorkspace, reloadRegistry } = useWorkspaceActions();
  const [name, setName] = useState("");
  const hasWorkspaces = (registry?.workspaces.length ?? 0) > 0;
  const needsStorage = Boolean(registry) && !registry?.storageFolder;

  const { loading: creating, runPromise: createLocal } = usePromise({
    promise: () => workspaceService.create(name.trim() || "My workspace"),
    onSuccessAsync: async ({ workspaceId }) => {
      toast.success("Workspace created");
      setName("");
      await openWorkspace(workspaceId);
      onDone?.();
    },
  });

  const { loading: opening, runPromise: openFolder } = usePromise({
    showErrorToast: false,
    promise: () => workspaceService.openFolder(),
    onSuccessAsync: async ({ workspaceId, alreadyAdded }) => {
      if (alreadyAdded) toast("Already in Aurolis — opened it.");
      await openWorkspace(workspaceId);
      onDone?.();
    },
    onError: (error) => {
      if (!(error instanceof WorkspaceFailure && error.code === "cancelled")) {
        toast.error(error.message);
      }
    },
    onFinallyAsync: async () => {
      await reloadRegistry();
    },
  });

  const isPage = variant === "page";

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        isPage && "mx-auto max-w-240 px-8 pt-8 pb-12",
      )}
    >
      {isPage ? (
        <PageHeader
          size="display"
          title={
            <>
              {hasWorkspaces
                ? "Add a workspace"
                : "Set up your first workspace"}
              {user && !hasWorkspaces ? (
                <span className="text-mute">, @{user.login}</span>
              ) : null}
            </>
          }
          description={
            needsStorage
              ? "First, choose where your workspaces live on this computer. Then clone one from GitHub, start a new one, or open a repository you already have."
              : "A workspace is a git repository with your collections and environments. Clone one from GitHub, start a new one, or open a repository you already have."
          }
        />
      ) : null}

      {needsStorage ? (
        <StorageStep variant={variant} />
      ) : (
        <>
          <Card className="gap-4 px-6 py-6">
            <div>
              <h2 className="text-xl font-medium tracking-[-0.01em] text-foreground">
                Clone a repository
              </h2>
              <p className="text-[13.5px] text-mute">
                Paste a GitHub URL or owner/repo, any https:// or SSH git URL,
                or pick one of your repositories.
              </p>
            </div>
            <ClonePanel onDone={onDone} />
          </Card>

          <div className={cn("grid gap-4", isPage && "md:grid-cols-2")}>
            <Option
              icon={FolderPlus}
              title="Create a local workspace"
              description="A new git repository on this computer. Publish it to GitHub any time."
            >
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createLocal();
                }}
              >
                <Input
                  aria-label="Workspace name"
                  placeholder="My workspace"
                  value={name}
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  className="h-9 bg-surface-raise"
                />
                <Button type="submit" variant="outline" disabled={creating}>
                  <Plus />
                  Create
                </Button>
              </form>
            </Option>
            <Option
              icon={FolderGit2}
              title="Open a folder on this computer"
              description="Use a repository you already cloned. Aurolis works on it in place."
            >
              <Button
                variant="outline"
                className="self-end"
                disabled={opening}
                onClick={() => void openFolder()}
              >
                Choose folder…
              </Button>
            </Option>
          </div>

          <StorageFolderLine />
        </>
      )}
    </div>
  );
}

export default GetStarted;
