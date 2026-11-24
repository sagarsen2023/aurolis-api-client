import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { FaGithub } from "react-icons/fa6";
import {
  ArrowRight,
  GitBranch,
  Loader,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { GITHUB_SUGGESTION_LIMIT } from "@/constants/workspace";
import { registryAtom } from "@/context/workspace-context";
import { useWorkspaceActions } from "@/hooks/use-workspaces";
import { usePromise } from "@/hooks/usePromise";
import { cn } from "@/lib/utils";
import { githubService } from "@/services/github.service";
import {
  WorkspaceFailure,
  workspaceService,
} from "@/services/workspace.service";
import type { GithubRepository } from "@/types/github/github-response.type";
import { timeAgo } from "@/utils/format-date";

const looksLikeRemote = (value: string) =>
  /^(https:\/\/|ssh:\/\/|[\w.-]+@[\w.-]+:)/.test(value) ||
  /^(?:github\.com\/)?[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(value);

const repoKey = (owner: string, repo: string) =>
  `${owner}/${repo}`.toLowerCase();

function CloneProgress({ target }: Readonly<{ target: string }>) {
  return (
    <div
      role="status"
      className="flex items-center gap-4 rounded-2xl border border-line bg-surface-raise px-5 py-4"
    >
      <Loader className="size-5 animate-spin text-vio" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-foreground">
          Cloning {target}…
        </p>
        <p className="text-[13px] text-mute">
          Large repositories can take a minute. Only the files you need are
          downloaded.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void workspaceService.cancelClone()}
      >
        Cancel
      </Button>
    </div>
  );
}

function RepoRow({
  repo,
  added,
  disabled,
  onClone,
}: Readonly<{
  repo: GithubRepository;
  added: boolean;
  disabled: boolean;
  onClone: () => void;
}>) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-icon text-ink">
        <FaGithub className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[14.5px] text-foreground">
          <span className="truncate">{repo.fullName}</span>
          {repo.private ? (
            <Lock className="size-3.5 shrink-0 text-dim" aria-label="Private" />
          ) : null}
          {!repo.permissions.push ? (
            <Pill className="h-5 text-[11.5px]">Read-only</Pill>
          ) : null}
        </p>
        <p className="truncate text-[12.5px] text-mute">
          {[
            repo.description,
            repo.pushedAt ? `Updated ${timeAgo(repo.pushedAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || repo.defaultBranch}
        </p>
      </div>
      <Button
        variant={added ? "ghost" : "outline"}
        size="xs"
        className="h-7 px-3 text-[13px]"
        disabled={disabled}
        onClick={onClone}
      >
        {added ? "Open" : "Clone"}
      </Button>
    </li>
  );
}

function ClonePanel({ onDone }: Readonly<{ onDone?: () => void }>) {
  const registry = useAtomValue(registryAtom);
  const { openWorkspace, reloadRegistry } = useWorkspaceActions();
  const [query, setQuery] = useState("");
  const [cloningTarget, setCloningTarget] = useState<string | null>(null);
  const pendingUrl = useRef("");

  const [repos, setRepos] = useState<GithubRepository[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const { loading: loadingRepos, runPromise: loadRepos } = usePromise({
    initialLoading: true,
    showErrorToast: false,
    promise: () => githubService.getRepositories(),
    onSuccess: (result) => {
      setRepos(result);
      setReposError(null);
    },
    onError: (error) => setReposError(error.message),
  });

  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  const addedRepos = useMemo(
    () =>
      new Set(
        (registry?.workspaces ?? [])
          .filter((w) => w.remote?.github)
          .map((w) => repoKey(w.remote!.github!.owner, w.remote!.github!.repo)),
      ),
    [registry],
  );

  const { loading: cloning, runPromise: runClone } = usePromise({
    showErrorToast: false,
    promise: async () => {
      if (!registry?.storageFolder)
        await workspaceService.setStorage("default");
      return workspaceService.clone(pendingUrl.current);
    },
    onSuccessAsync: async (result) => {
      toast.success(
        result.alreadyAdded
          ? "Already in Aurolis — opened it."
          : `Cloned ${pendingUrl.current.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "")}`,
      );
      await openWorkspace(result.workspaceId);
      onDone?.();
    },
    onError: (error) => {
      if (error instanceof WorkspaceFailure && error.code === "cancelled") {
        toast("Clone cancelled.");
        return;
      }
      toast.error(error.message);
    },
    onFinallyAsync: async () => {
      setCloningTarget(null);
      await reloadRegistry();
    },
  });

  const cloneUrl = (url: string, label: string) => {
    pendingUrl.current = url;
    setCloningTarget(label);
    void runClone();
  };

  const trimmed = query.trim();
  const isRemote = looksLikeRemote(trimmed);
  const sorted = useMemo(
    () =>
      [...(repos ?? [])].sort((a, b) =>
        (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""),
      ),
    [repos],
  );
  const filtered =
    trimmed && !isRemote
      ? sorted.filter((repo) =>
          `${repo.fullName} ${repo.description ?? ""}`
            .toLowerCase()
            .includes(trimmed.toLowerCase()),
        )
      : sorted;
  const visible = filtered.slice(0, trimmed ? 20 : GITHUB_SUGGESTION_LIMIT);

  const submit = () => {
    if (!trimmed) return;
    if (isRemote) {
      cloneUrl(trimmed, trimmed);
      return;
    }
    if (visible[0]) cloneUrl(visible[0].cloneUrl, visible[0].fullName);
  };

  if (cloning && cloningTarget) return <CloneProgress target={cloningTarget} />;

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-dim"
            aria-hidden
          />
          <Input
            autoFocus
            aria-label="Repository URL or search"
            placeholder="Paste a git URL or owner/repo, or search your GitHub repos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 bg-card pl-10 text-[14.5px]"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-11 gap-2 px-5 hover:bg-lav-hover"
          disabled={!trimmed || (!isRemote && visible.length === 0)}
        >
          <GitBranch strokeWidth={1.8} />
          Clone
        </Button>
      </form>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-mute">
            {trimmed && !isRemote
              ? "Matching repositories"
              : "Suggested from your GitHub"}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh repositories"
            disabled={loadingRepos}
            onClick={() => void loadRepos()}
          >
            <RefreshCw
              className={cn("size-4", loadingRepos && "animate-spin")}
            />
          </Button>
        </div>

        {loadingRepos && !repos ? (
          <ul aria-busy className="flex flex-col gap-2 py-1">
            {Array.from({ length: 3 }, (_, index) => (
              <li
                key={index}
                className="h-12 animate-pulse rounded-xl bg-surface-raise"
              />
            ))}
          </ul>
        ) : reposError && !repos ? (
          <p className="py-3 text-[13.5px] text-mute">
            {reposError} You can still paste a git URL above.
          </p>
        ) : sorted.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line px-4 py-3">
            <p className="text-[13.5px] text-mute">
              Aurolis can't see any of your repositories yet. Install the
              Aurolis GitHub App on the ones you want to use.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void githubService.openInstallPage()}
            >
              Install on GitHub
              <ArrowRight />
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-3 text-[13.5px] text-mute">
            No repositories match “{trimmed}”.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((repo) => {
              const added = addedRepos.has(repoKey(repo.owner, repo.name));
              return (
                <RepoRow
                  key={repo.id}
                  repo={repo}
                  added={added}
                  disabled={cloning}
                  onClone={() => cloneUrl(repo.cloneUrl, repo.fullName)}
                />
              );
            })}
          </ul>
        )}
        {sorted.length > visible.length && !trimmed ? (
          <p className="pt-2 text-[12.5px] text-dim">
            Showing {visible.length} of {sorted.length}. Type to search the
            rest.
          </p>
        ) : null}
        {sorted.length > 0 ? (
          <Button
            variant="link"
            size="xs"
            className="mt-1 h-auto px-0 text-[12.5px] text-mute"
            onClick={() => void githubService.openInstallPage()}
          >
            Missing a repository? Give Aurolis access on GitHub
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default ClonePanel;
