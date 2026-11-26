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
import { Skeleton } from "@/components/ui/skeleton";
import { githubUserAtom } from "@/context/auth-context";
import {
  addWorkspaceOpenAtom,
  currentEnvironmentAtom,
  publishWorkspaceOpenAtom,
} from "@/context/workspace-context";
import { workspaceService } from "@/services/workspace.service";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import { FormatIssues } from "@/modules/workspace/workspace-states";
import WorkspaceGate from "@/modules/workspace/workspace-gate";
import ResponseHealth from "./response-health";
import StatCard from "./stat-card";
import WorkspaceAbout from "./workspace-about";
import WorkspaceRequests from "./workspace-requests";
import { countItems } from "@/lib/collection-ops";

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

const PAGE = "mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:gap-6 md:p-6";

function DashboardSkeleton() {
  return (
    <div aria-busy className={PAGE}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-30" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
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
  const setPublishOpen = useSetAtom(publishWorkspaceOpenAtom);
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
    <div className={PAGE}>
      <PageHeader
        size="compact"
        title={
          <>
            Welcome back
            {user ? (
              <span className="text-muted-foreground"> @{user.login}</span>
            ) : null}
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <FolderGit2 className="size-3.5" aria-hidden />
              <span className="font-mono text-xs">{workspace.displayPath}</span>
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
            {workspace.git.remoteUrl ? null : (
              <Button variant="outline" onClick={() => setPublishOpen(true)}>
                <FaGithub aria-hidden />
                Publish to GitHub
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => void workspaceService.reveal(workspace.entry.id)}
            >
              <FolderOpen />
              Show in folder
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus />
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WorkspaceRequests collections={collections} />
        <ResponseHealth git={workspace.git} />
      </div>

      <WorkspaceAbout workspace={workspace} />
    </div>
  );
}

function Dashboard() {
  return (
    <WorkspaceGate loading={<DashboardSkeleton />}>
      {(workspace) => <WorkspaceOverview workspace={workspace} />}
    </WorkspaceGate>
  );
}

export default Dashboard;
