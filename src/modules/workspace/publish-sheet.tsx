import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Globe, Link2, Lock, Plus } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { GITHUB_NEW_REPO_URL } from "@/constants/publish";
import { WORKSPACE_ERROR_MESSAGES } from "@/constants/workspace";
import { githubUserAtom } from "@/context/auth-context";
import {
  activeWorkspaceAtom,
  publishWorkspaceOpenAtom,
} from "@/context/workspace-context";
import { useWorkspaceActions } from "@/hooks/use-workspaces";
import { usePromise } from "@/hooks/usePromise";
import { githubService } from "@/services/github.service";
import { workspaceService } from "@/services/workspace.service";
import type {
  GithubInstallation,
  GithubRepository,
} from "@/types/github/github-response.type";
import type {
  OpenedWorkspace,
  PublishResult,
} from "@/types/workspace/workspace-store.type";
import { repoNameError, toRepoName } from "@/utils/repo-name";
import {
  PublishDone,
  PublishProgress,
  type FailureAction,
  type PublishMode,
  type PublishRequest,
  type PublishStep,
} from "./publish-progress";
import { ChoiceCard } from "@/components/choice-card";

type Phase = "form" | "progress" | "done";
type Visibility = "private" | "public";

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function ownerOptions(
  login: string | undefined,
  installations: GithubInstallation[],
) {
  const owners = login ? [login] : [];
  for (const installation of installations) {
    const account = installation.account;
    if (account && !owners.some((owner) => sameName(owner, account))) {
      owners.push(account);
    }
  }
  return owners;
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: Readonly<{
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[12.5px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] text-mute">{hint}</p>
      ) : null}
    </div>
  );
}

function PublishFlow({
  workspace,
  onClose,
}: Readonly<{ workspace: OpenedWorkspace; onClose: () => void }>) {
  const user = useAtomValue(githubUserAtom);
  const { openWorkspace } = useWorkspaceActions();
  const changedFiles = workspace.git.changedFiles;

  const [name, setName] = useState(() => toRepoName(workspace.entry.name));
  const [nameTouched, setNameTouched] = useState(false);
  const [owner, setOwner] = useState("");
  const [mode, setMode] = useState<PublishMode>("create");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [commitChanges, setCommitChanges] = useState(true);

  const [phase, setPhase] = useState<Phase>("form");
  const [step, setStep] = useState<PublishStep>("repository");
  const [failure, setFailure] = useState<Error | null>(null);
  const [activeRequest, setActiveRequest] = useState<PublishRequest | null>(
    null,
  );
  const [result, setResult] = useState<PublishResult | null>(null);
  const request = useRef<PublishRequest | null>(null);
  const ready = useRef<GithubRepository | null>(null);
  const [installations, setInstallations] = useState<GithubInstallation[]>([]);
  const { loading: loadingOwners, runPromise: loadOwners } = usePromise({
    initialLoading: true,
    showErrorToast: false,
    promise: () => githubService.getInstallations(),
    onSuccess: setInstallations,
  });

  useEffect(() => {
    void loadOwners();
  }, [loadOwners]);

  const owners = useMemo(
    () => ownerOptions(user?.login, installations),
    [user?.login, installations],
  );
  const selectedOwner = owners.find((o) => sameName(o, owner)) ?? owners[0];
  const trimmedName = name.trim();
  const nameError = repoNameError(name);

  const { loading: publishing, runPromise: publish } = usePromise({
    showErrorToast: false,
    promise: async () => {
      const current = request.current;
      if (!current) throw new Error("Nothing to publish.");
      setFailure(null);
      setPhase("progress");
      let repository =
        ready.current &&
        sameName(ready.current.owner, current.owner) &&
        sameName(ready.current.name, current.name)
          ? ready.current
          : null;
      if (!repository) {
        setStep("repository");
        repository =
          current.mode === "create"
            ? await githubService.createRepository({
                owner: current.owner,
                name: current.name,
                private: current.isPrivate,
              })
            : await githubService.getEmptyRepository({
                owner: current.owner,
                name: current.name,
              });
        ready.current = repository;
      }
      setStep("push");
      return workspaceService.publish({
        id: workspace.entry.id,
        owner: repository.owner,
        repo: repository.name,
        commitChanges: current.commitChanges,
      });
    },
    onSuccessAsync: async (published) => {
      setResult(published);
      setPhase("done");
      toast.success(
        `Published to ${published.webUrl.replace("https://github.com/", "")}`,
      );
      await openWorkspace(workspace.entry.id, { quiet: true });
    },
    onError: setFailure,
  });

  const start = (overrides: Partial<PublishRequest> = {}) => {
    if (!selectedOwner || nameError) return;
    const next: PublishRequest = {
      mode,
      owner: selectedOwner,
      name: trimmedName,
      isPrivate: visibility === "private",
      commitChanges: commitChanges && changedFiles > 0,
      ...overrides,
    };
    if (overrides.mode) setMode(overrides.mode);
    request.current = next;
    setActiveRequest(next);
    void publish();
  };

  const handleAction = (action: FailureAction) => {
    const current = request.current;
    switch (action) {
      case "retry":
        void publish();
        return;
      case "use-existing":
        start({ mode: "existing" });
        return;
      case "create-on-github":
        if (current) {
          const query = new URLSearchParams({
            owner: current.owner,
            name: current.name,
            visibility: current.isPrivate ? "private" : "public",
          });
          window.open(`${GITHUB_NEW_REPO_URL}?${query}`, "_blank", "noopener");
        }
        return;
      case "give-access":
        void githubService.openInstallPage();
        return;
      case "back":
        setFailure(null);
        setPhase("form");
        return;
    }
  };

  if (phase === "done" && result && activeRequest) {
    return (
      <PublishDone
        result={result}
        fullName={result.webUrl.replace("https://github.com/", "")}
        onClose={onClose}
      />
    );
  }

  if (phase === "progress" && activeRequest) {
    return (
      <PublishProgress
        request={activeRequest}
        step={step}
        failure={publishing ? null : failure}
        branch={workspace.git.branch}
        changedFiles={changedFiles}
        onAction={handleAction}
      />
    );
  }

  if (workspace.git.remoteUrl) {
    return (
      <p className="rounded-2xl border border-line bg-card px-5 py-4 text-[14px] text-mute">
        This workspace is already linked to{" "}
        <span className="font-mono text-foreground">
          {workspace.git.remoteUrl}
        </span>
        .
      </p>
    );
  }

  if (!workspace.git.branch) {
    return (
      <p className="rounded-2xl border border-line bg-card px-5 py-4 text-[14px] text-mute">
        {WORKSPACE_ERROR_MESSAGES.detached_head}
      </p>
    );
  }

  const fullName = `${selectedOwner ?? "you"}/${trimmedName || "…"}`;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setNameTouched(true);
        start();
      }}
    >
      <div className="flex flex-col gap-2">
        <Input
          id="publish-repo-name"
          label="Repository name"
          autoFocus
          value={name}
          maxLength={100}
          spellCheck={false}
          error={nameTouched && nameError ? nameError : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setNameTouched(true);
          }}
          className="h-10 bg-card font-mono text-[14px]"
        />
        {nameTouched && nameError ? null : (
          <p className="text-[12.5px] text-mute">
            Prefilled from the workspace name. It will be{" "}
            <span className="font-mono text-foreground">
              github.com/{fullName}
            </span>
          </p>
        )}
      </div>

      <Field
        label="Owner"
        hint={
          owners.length > 1
            ? "Your account, or an organization where the Aurolis GitHub App is installed."
            : "Install the Aurolis GitHub App on an organization to publish there."
        }
      >
        <Select
          items={owners.map((login) => ({ value: login, label: login }))}
          value={selectedOwner ?? null}
          disabled={owners.length === 0}
          onValueChange={(value) => {
            if (typeof value === "string") setOwner(value);
          }}
        >
          <SelectTrigger
            aria-label="Owner"
            className="w-full bg-card"
            disabled={loadingOwners && owners.length === 0}
          >
            <SelectValue placeholder="Loading accounts…" />
          </SelectTrigger>
          <SelectContent>
            {owners.map((login) => (
              <SelectItem key={login} value={login}>
                {login}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex flex-col gap-2">
        <Label id="publish-mode-label">Repository</Label>
        <div
          role="radiogroup"
          aria-labelledby="publish-mode-label"
          className="flex flex-col gap-2"
        >
          <ChoiceCard
            selected={mode === "create"}
            onSelect={() => setMode("create")}
            icon={Plus}
            title="Create a new repository"
            description={`Aurolis creates ${fullName} on GitHub.`}
          />
          <ChoiceCard
            selected={mode === "existing"}
            onSelect={() => setMode("existing")}
            icon={Link2}
            title="Use an existing empty repository"
            description={`Publish to ${fullName}, an empty repository you already created.`}
          />
        </div>
      </div>

      {mode === "create" ? (
        <div className="flex flex-col gap-2">
          <Label id="publish-visibility-label">Visibility</Label>
          <div
            role="radiogroup"
            aria-labelledby="publish-visibility-label"
            className="grid gap-2 sm:grid-cols-2"
          >
            <ChoiceCard
              selected={visibility === "private"}
              onSelect={() => setVisibility("private")}
              icon={Lock}
              title="Private"
              description="Only you and people you add can see it."
            />
            <ChoiceCard
              selected={visibility === "public"}
              onSelect={() => setVisibility("public")}
              icon={Globe}
              title="Public"
              description="Anyone on the internet can see it."
            />
          </div>
        </div>
      ) : null}

      {changedFiles > 0 ? (
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-card px-4 py-3.5">
          <div>
            <Label htmlFor="publish-commit" className="text-[14.5px]">
              Commit {changedFiles} uncommitted{" "}
              {changedFiles === 1 ? "file" : "files"} first
            </Label>
            <p className="mt-1 text-[13px] text-mute">
              Otherwise only what's already committed is published.
            </p>
          </div>
          <Switch
            id="publish-commit"
            checked={commitChanges}
            onCheckedChange={setCommitChanges}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          className="h-10 gap-2 px-5 hover:bg-lav-hover"
          disabled={!selectedOwner || (nameTouched && Boolean(nameError))}
        >
          <FaGithub aria-hidden />
          Publish to GitHub
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PublishSheet() {
  const [open, setOpen] = useAtom(publishWorkspaceOpenAtom);
  const workspace = useAtomValue(activeWorkspaceAtom);

  return (
    <Sheet open={open && Boolean(workspace)} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-xl font-medium">
            Publish to GitHub
          </SheetTitle>
          <SheetDescription>
            Put {workspace?.entry.name ?? "this workspace"} in a GitHub
            repository so you can share it and keep its history there.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          {open && workspace ? (
            <PublishFlow
              key={workspace.entry.id}
              workspace={workspace}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default PublishSheet;
