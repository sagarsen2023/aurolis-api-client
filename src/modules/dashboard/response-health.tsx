import { Link } from "@tanstack/react-router";
import { GitBranch, Zap } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import { RESPONSE_HEALTH } from "@/constants/dashboard";
import type { WorkspaceGitState } from "@/types/workspace/workspace-store.type";
import ListRow from "./list-row";

const SEGMENTS = [
  { key: "ok", label: "2xx/3xx", className: "bg-status-2xx" },
  { key: "clientError", label: "4xx", className: "bg-status-4xx" },
  { key: "serverError", label: "5xx", className: "bg-status-5xx" },
  { key: "timeout", label: "Timeouts", className: "bg-status-timeout" },
] as const;

const BADGE = "h-5 px-2 text-xs";

function StatusClassBar({
  counts,
}: Readonly<{ counts: typeof RESPONSE_HEALTH }>) {
  const total = SEGMENTS.reduce((sum, s) => sum + counts[s.key], 0);
  const percent = (key: (typeof SEGMENTS)[number]["key"]) =>
    total === 0 ? 0 : Math.round((counts[key] / total) * 100);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={
          total === 0
            ? "No requests sent yet"
            : SEGMENTS.map((s) => `${s.label}: ${counts[s.key]}`).join(", ")
        }
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        {SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => (
          <span
            key={s.key}
            style={{ width: `${percent(s.key)}%` }}
            className={s.className}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", s.className)}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-medium text-foreground tabular-nums sm:ml-0">
              {percent(s.key)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function gitSummary(git: WorkspaceGitState) {
  const branch = git.branch ? ` on ${git.branch}` : "";
  if (git.changedFiles > 0) {
    return `${git.changedFiles} ${git.changedFiles === 1 ? "file has" : "files have"} uncommitted changes${branch}.`;
  }
  if (git.unpushedCommits > 0) {
    return `${git.unpushedCommits} ${git.unpushedCommits === 1 ? "commit" : "commits"} not pushed yet${branch}.`;
  }
  return `Everything is committed${branch}.`;
}

function gitBadge(git: WorkspaceGitState) {
  if (git.changedFiles > 0) {
    return (
      <Pill variant="warn" className={BADGE}>
        {git.changedFiles} changed
      </Pill>
    );
  }
  if (git.unpushedCommits > 0) {
    return (
      <Pill variant="warn" className={BADGE}>
        {git.unpushedCommits} to push
      </Pill>
    );
  }
  return (
    <Pill variant="ok" className={BADGE}>
      Clean
    </Pill>
  );
}

function ResponseHealth({ git }: Readonly<{ git: WorkspaceGitState }>) {
  const sent = Object.values(RESPONSE_HEALTH).reduce((a, b) => a + b, 0);

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Response health</CardTitle>
        <CardDescription>
          Status classes across {sent} sent{" "}
          {sent === 1 ? "request" : "requests"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <StatusClassBar counts={RESPONSE_HEALTH} />
        <ul className="divide-y divide-border">
          <ListRow
            icon={GitBranch}
            title={git.remoteUrl ? "Git repository" : "Local git repository"}
            description={gitSummary(git)}
            action={gitBadge(git)}
          />
          <ListRow
            icon={Zap}
            title="Load testing"
            description="Run a request many times and watch how it holds up"
            action={
              <Link
                to="/load-testing"
                className="text-[13px] font-medium text-vio underline-offset-4 hover:underline"
              >
                Open
              </Link>
            }
          />
        </ul>
      </CardContent>
    </Card>
  );
}

export default ResponseHealth;
