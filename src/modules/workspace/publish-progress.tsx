import {
  ArrowUpRight,
  Check,
  Circle,
  CircleAlert,
  CircleCheck,
  Loader,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GithubApiFailure } from "@/services/github.service";
import { WorkspaceFailure } from "@/services/workspace.service";
import type { PublishResult } from "@/types/workspace/workspace-store.type";

export type PublishMode = "create" | "existing";
export type PublishStep = "repository" | "push";
export type FailureAction =
  "retry" | "use-existing" | "create-on-github" | "give-access" | "back";

export interface PublishRequest {
  mode: PublishMode;
  owner: string;
  name: string;
  isPrivate: boolean;
  commitChanges: boolean;
}

type StepStatus = "pending" | "active" | "done" | "failed";

const ACTION_LABELS: Record<FailureAction, string> = {
  retry: "Try again",
  "use-existing": "Publish to it",
  "create-on-github": "Create on GitHub",
  "give-access": "Give Aurolis access",
  back: "Back",
};

interface FailureHelp {
  title: string;
  body: string;
  actions: FailureAction[];
}

function describeGithubFailure(
  error: GithubApiFailure,
  request: PublishRequest,
): FailureHelp {
  const fullName = `${request.owner}/${request.name}`;
  const details = error.info.message ? ` ${error.info.message}` : "";
  switch (error.code) {
    case "already_exists":
      return {
        title: `${fullName} already exists`,
        body: "If it's empty, Aurolis can publish to it instead.",
        actions: ["use-existing", "back"],
      };
    case "forbidden":
      return request.mode === "create"
        ? {
            title: `Aurolis can't create repositories for ${request.owner}`,
            body: `The Aurolis GitHub App isn't allowed to create repositories here. Give it the Administration (read and write) repository permission and accept it on the installation, or create an empty repository on GitHub with this name, then publish to it.${details}`,
            actions: ["create-on-github", "use-existing", "back"],
          }
        : {
            title: `You can't push to ${fullName}`,
            body: "Ask an owner of the repository for write access, or choose another repository.",
            actions: ["back"],
          };
    case "not_found":
      return {
        title: `Aurolis can't see ${fullName}`,
        body: "Check the owner and name. If the repository exists, give the Aurolis GitHub App access to it, then try again.",
        actions: ["give-access", "retry", "back"],
      };
    case "not_empty":
      return {
        title: `${fullName} isn't empty`,
        body: "Aurolis only publishes to an empty repository, so nothing on GitHub is overwritten. Choose another name, or clone that repository as a new workspace.",
        actions: ["back"],
      };
    case "validation":
      return {
        title: "GitHub didn't accept that repository",
        body: "Check the name and try again.",
        actions: ["back"],
      };
    case "signed_out":
      return { title: "Signed out", body: error.message, actions: ["back"] };
    default:
      return {
        title: "Couldn't reach the repository",
        body: error.message,
        actions: ["retry", "back"],
      };
  }
}

function describeFailure(error: Error, request: PublishRequest): FailureHelp {
  if (error instanceof GithubApiFailure) {
    return describeGithubFailure(error, request);
  }
  const fullName = `${request.owner}/${request.name}`;
  if (error instanceof WorkspaceFailure) {
    switch (error.code) {
      case "auth_failed":
      case "repository_not_found":
        return {
          title: `GitHub didn't let Aurolis push to ${fullName}`,
          body: "If the Aurolis GitHub App only has access to selected repositories, add this one to it on GitHub, then try again.",
          actions: ["give-access", "retry", "back"],
        };
      case "nothing_to_publish":
      case "detached_head":
      case "remote_exists":
        return {
          title: "Nothing was published",
          body: error.message,
          actions: ["back"],
        };
      default:
        break;
    }
  }
  return {
    title: "Couldn't publish",
    body: error.message,
    actions: ["retry", "back"],
  };
}

function StepIcon({ status }: Readonly<{ status: StepStatus }>) {
  if (status === "active") {
    return <Loader className="size-4.5 animate-spin text-vio" aria-hidden />;
  }
  if (status === "done") {
    return <CircleCheck className="size-4.5 text-success" aria-hidden />;
  }
  if (status === "failed") {
    return <CircleAlert className="size-4.5 text-danger" aria-hidden />;
  }
  return <Circle className="size-4.5 text-dim" aria-hidden />;
}

function StepRow({
  status,
  label,
}: Readonly<{ status: StepStatus; label: string }>) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <StepIcon status={status} />
      <span
        className={cn(
          "text-[14.5px]",
          status === "pending" ? "text-mute" : "text-foreground",
        )}
      >
        {label}
      </span>
      <span className="sr-only">{status}</span>
    </li>
  );
}

export function PublishProgress({
  request,
  step,
  failure,
  branch,
  changedFiles,
  onAction,
}: Readonly<{
  request: PublishRequest;
  step: PublishStep;
  failure: Error | null;
  branch: string | null;
  changedFiles: number;
  onAction: (_action: FailureAction) => void;
}>) {
  const fullName = `${request.owner}/${request.name}`;
  const statusOf = (target: PublishStep): StepStatus => {
    if (step === target) return failure ? "failed" : "active";
    return target === "repository" ? "done" : "pending";
  };
  const pushTarget = branch ? `push ${branch}` : "push your commits";
  const pushLabel = request.commitChanges
    ? `Commit ${changedFiles} ${changedFiles === 1 ? "file" : "files"} and ${pushTarget}`
    : `${pushTarget.charAt(0).toUpperCase()}${pushTarget.slice(1)}`;
  const help = failure ? describeFailure(failure, request) : null;

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <ol className="divide-y divide-line rounded-2xl border border-line bg-card px-5">
        <StepRow
          status={statusOf("repository")}
          label={
            request.mode === "create"
              ? `Create ${fullName} on GitHub`
              : `Check that ${fullName} is empty`
          }
        />
        <StepRow status={statusOf("push")} label={`${pushLabel} to GitHub`} />
      </ol>

      {help ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raise px-5 py-4"
        >
          <div>
            <p className="text-[15px] text-foreground">{help.title}</p>
            <p className="mt-1 text-[13.5px] text-mute">{help.body}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {help.actions.map((action, index) => (
              <Button
                key={action}
                variant={
                  index === 0 && action !== "back" ? "default" : "outline"
                }
                size="sm"
                className={cn(index === 0 && "hover:bg-lav-hover")}
                onClick={() => onAction(action)}
              >
                {ACTION_LABELS[action]}
                {action === "create-on-github" || action === "give-access" ? (
                  <ArrowUpRight />
                ) : null}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PublishDone({
  result,
  fullName,
  onClose,
}: Readonly<{ result: PublishResult; fullName: string; onClose: () => void }>) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card px-5 py-5">
      <span className="grid size-10 place-items-center rounded-full bg-surface-icon text-success">
        <Check className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <div>
        <p className="text-[17px] text-foreground">Published to {fullName}</p>
        <p className="mt-1 text-[13.5px] text-mute">
          {result.committed ? "Your changes were committed and the " : "The "}
          <span className="font-mono">{result.branch}</span> branch is on
          GitHub. This workspace is now linked to {fullName}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className="hover:bg-lav-hover"
          onClick={() => window.open(result.webUrl, "_blank", "noopener")}
        >
          Open on GitHub
          <ArrowUpRight />
        </Button>
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
