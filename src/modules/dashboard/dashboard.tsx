import { useAtomValue, useSetAtom } from "jotai";
import {
  FolderGit2,
  FolderOpen,
  GitBranch,
  Globe,
  Layers,
  Loader,
  Plus,
  Send,
} from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { githubUserAtom } from "@/context/auth-context";
import {
  activeWorkspaceStateAtom,
  addWorkspaceOpenAtom,
  currentEnvironmentAtom,
} from "@/context/workspace-context";
import { workspaceService } from "@/services/workspace.service";
import type { CollectionItem } from "@/types/workspace/collection.type";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import GetStarted from "@/modules/workspace/get-started";
import {
  FormatIssues,
  MissingWorkspace,
  NotAWorkspace,
  WorkspaceLoadError,
} from "@/modules/workspace/workspace-states";
import ResponseHealth from "./response-health";
import StatCard from "./stat-card";
import WorkspaceRequests from "./workspace-requests";

function countItems(items: CollectionItem[]): {
  requests: number;
  examples: number;
} {
  return items.reduce(
    (total, item) => {
      if (item.type === "folder") {
        const nested = countItems(item.items);
        return {
          requests: total.requests + nested.requests,
          examples: total.examples + nested.examples,
        };
      }
      return {
        requests: total.requests + 1,
        examples: total.examples + item.examples.length,
      };
    },
    { requests: 0, examples: 0 },
  );
}

function remoteLabel(workspace: OpenedWorkspace) {
  const github = workspace.entry.remote?.github;
  if (github) return `${github.owner}/${github.repo}`;
  if (workspace.git.remoteUrl) {
    return workspace.git.remoteUrl
      .replace(/^https?:\/\//, "")
      .replace(/\.git$/, "");
  }
  return "Local only";
}

function DashboardSkeleton() {
  return (
    <div
      aria-busy
      className="mx-auto flex w-full max-w-310 flex-col gap-4 px-8 pt-8 pb-12"
    >
      <div className="h-12 w-80 animate-pulse rounded-xl bg-surface-raise" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-37.5 animate-pulse rounded-3xl bg-surface-raise"
          />
        ))}
      </div>
    </div>
  );
}

function WorkspaceOverview({
  workspace,
}: Readonly<{ workspace: OpenedWorkspace }>) {
  const user = useAtomValue(githubUserAtom);
  const environment = useAtomValue(currentEnvironmentAtom);
  const setAddOpen = useSetAtom(addWorkspaceOpenAtom);
  const data = workspace.data;
  const collections = data?.collections ?? [];
  const totals = collections.reduce(
    (sum, collection) => {
      const counts = countItems(collection.items);
      return {
        requests: sum.requests + counts.requests,
        examples: sum.examples + counts.examples,
      };
    },
    { requests: 0, examples: 0 },
  );
  const environments = data?.environments.length ?? 0;
  const changes = workspace.git.changedFiles;
  const github = workspace.entry.remote?.github;

  return (
    <div className="mx-auto flex w-full max-w-310 flex-col gap-4 px-8 pt-8 pb-12">
      <PageHeader
        className="mb-4"
        size="display"
        title={
          <>
            Welcome back
            {user ? <span className="text-mute"> @{user.login}</span> : null}
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <FolderGit2 className="size-3.5" aria-hidden />
              <span className="font-mono">{workspace.displayPath}</span>
            </span>
            {workspace.git.branch ? (
              <span className="flex items-center gap-1.5">
                <GitBranch className="size-3.5" aria-hidden />
                {workspace.git.branch}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              {github ? (
                <FaGithub className="size-3.5" aria-hidden />
              ) : (
                <Globe className="size-3.5" aria-hidden />
              )}
              {remoteLabel(workspace)}
            </span>
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              className="h-10 gap-2 px-5 text-[15px]"
              onClick={() => void workspaceService.reveal(workspace.entry.id)}
            >
              <FolderOpen strokeWidth={1.8} />
              Show in folder
            </Button>
            <Button
              size="lg"
              className="h-10 gap-2 px-5 text-[15px] hover:bg-lav-hover"
              onClick={() => setAddOpen(true)}
            >
              <Plus strokeWidth={1.8} />
              Add workspace
            </Button>
          </>
        }
      />

      <FormatIssues workspace={workspace} />

      <section
        aria-label="Workspace summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          title="Requests"
          badge={`${collections.length} ${collections.length === 1 ? "collection" : "collections"}`}
          icon={Send}
          value={totals.requests}
        />
        <StatCard
          title="Saved examples"
          badge="Kept responses"
          icon={Loader}
          value={totals.examples}
        />
        <StatCard
          title="Environments"
          badge={environment ? `Active: ${environment.name}` : "None yet"}
          icon={Layers}
          value={environments}
        />
        <StatCard
          title="Uncommitted changes"
          badge={
            changes === 0
              ? "All committed"
              : `${changes} ${changes === 1 ? "file" : "files"}`
          }
          icon={GitBranch}
          value={changes}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.08fr_1fr]">
        <WorkspaceRequests collections={collections} />
        <ResponseHealth git={workspace.git} />
      </div>
    </div>
  );
}

function Dashboard() {
  const state = useAtomValue(activeWorkspaceStateAtom);

  switch (state.status) {
    case "loading":
      return <DashboardSkeleton />;
    case "none":
      return <GetStarted variant="page" />;
    case "missing":
      return (
        <MissingWorkspace
          workspaceId={state.workspaceId}
          message={state.message}
        />
      );
    case "error":
      return <WorkspaceLoadError message={state.message} />;
    case "ready":
      return state.workspace.isWorkspace ? (
        <WorkspaceOverview workspace={state.workspace} />
      ) : (
        <NotAWorkspace workspace={state.workspace} />
      );
  }
}

export default Dashboard;
