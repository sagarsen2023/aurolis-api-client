import { Activity, Gauge } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ENGINE_ERROR_MESSAGES } from "@/constants/engine";
import type { LoadRun } from "@/context/load-testing-context";
import { cn } from "@/lib/utils";
import type { EngineErrorCode } from "@/types/engine/engine.type";
import type { LoadSnapshot } from "@/types/engine/load-engine.type";
import { formatBytes } from "@/utils/format-bytes";
import {
  formatCount,
  formatElapsed,
  formatMs,
  formatPercent,
  formatRate,
} from "./format";
import LoadTimeline from "./load-timeline";

const CLASSES = [
  { key: "ok", label: "2xx/3xx", className: "bg-status-2xx" },
  { key: "client", label: "4xx", className: "bg-status-4xx" },
  { key: "server", label: "5xx", className: "bg-status-5xx" },
  { key: "error", label: "No response", className: "bg-status-timeout" },
] as const;

type ClassKey = (typeof CLASSES)[number]["key"];

function classify(snapshot: LoadSnapshot): Record<ClassKey, number> {
  const counts: Record<ClassKey, number> = {
    ok: 0,
    client: 0,
    server: 0,
    error: 0,
  };
  for (const [status, count] of snapshot.statuses) {
    if (status >= 500) counts.server += count;
    else if (status >= 400) counts.client += count;
    else counts.ok += count;
  }
  counts.error = snapshot.errors.reduce((sum, entry) => sum + entry.count, 0);
  return counts;
}

function Metric({
  label,
  value,
  detail,
  tone,
}: Readonly<{
  label: string;
  value: string;
  detail?: string;
  tone?: "bad";
}>) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-surface-2 px-4 py-3">
      <span className="text-xs text-mute">{label}</span>
      <span
        className={cn(
          "text-[22px] leading-tight font-medium tracking-[-0.02em] text-foreground tabular-nums",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </span>
      {detail ? (
        <span className="truncate text-xs text-dim tabular-nums">{detail}</span>
      ) : null}
    </div>
  );
}

function settledPoints(run: LoadRun) {
  const snapshot = run.snapshot;
  const points = snapshot?.points ?? [];
  if (snapshot?.state === "running" && points.length > 1) {
    return points.slice(0, -1);
  }
  if (run.config.limitKind === "duration") {
    return points.filter((point) => point.second < run.config.durationSeconds);
  }
  return points;
}

function peakRate(run: LoadRun) {
  return Math.max(0, ...settledPoints(run).map((point) => point.requests));
}

function progressOf(run: LoadRun, snapshot: LoadSnapshot | null) {
  if (!snapshot) return 0;
  if (snapshot.state !== "running") return 1;
  const { config } = run;
  const ratio =
    config.limitKind === "duration"
      ? snapshot.elapsedMs / (config.durationSeconds * 1000)
      : snapshot.total / config.requestCount;
  return Math.min(Math.max(ratio, 0), 1);
}

function stateLabel(snapshot: LoadSnapshot | null) {
  if (!snapshot) return { text: "Starting", variant: "lav" as const };
  if (snapshot.state === "running")
    return { text: "Running", variant: "lav" as const };
  if (snapshot.state === "stopped")
    return { text: "Stopped", variant: "warn" as const };
  return { text: "Finished", variant: "ok" as const };
}

function StatusBreakdown({ snapshot }: Readonly<{ snapshot: LoadSnapshot }>) {
  const counts = classify(snapshot);
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={CLASSES.map((c) => `${c.label}: ${counts[c.key]}`).join(
          ", ",
        )}
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        {CLASSES.filter((c) => counts[c.key] > 0).map((c) => (
          <span
            key={c.key}
            style={{ width: `${(counts[c.key] / snapshot.total) * 100}%` }}
            className={c.className}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {CLASSES.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", c.className)}
            />
            <span className="text-muted-foreground">{c.label}</span>
            <span className="ml-auto font-medium text-foreground tabular-nums sm:ml-0">
              {formatPercent(counts[c.key], snapshot.total)}
            </span>
          </li>
        ))}
      </ul>
      {snapshot.statuses.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {snapshot.statuses.map(([status, count]) => (
            <li key={status}>
              <Pill variant="outline" className="font-mono tabular-nums">
                {status}
                <span className="font-sans text-mute">
                  {formatCount(count)}
                </span>
              </Pill>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ErrorList({ snapshot }: Readonly<{ snapshot: LoadSnapshot }>) {
  if (snapshot.errors.length === 0) return null;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {snapshot.errors.map((entry) => (
        <li key={entry.code} className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">
              {ENGINE_ERROR_MESSAGES[entry.code as EngineErrorCode] ??
                ENGINE_ERROR_MESSAGES.unknown}
            </p>
            {entry.message ? (
              <p className="mt-0.5 truncate font-mono text-xs text-dim">
                {entry.message}
              </p>
            ) : null}
          </div>
          <span className="text-sm font-medium text-destructive tabular-nums">
            {formatCount(entry.count)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LoadResultsEmpty() {
  return (
    <Card displayGradient className="items-center gap-4 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-icon text-vio ring-8 ring-surface-2">
        <Gauge className="size-6" strokeWidth={1.6} aria-hidden />
      </span>
      <h2 className="text-[22px] leading-tight font-medium tracking-[-0.02em] text-foreground">
        No run yet
      </h2>
      <p className="max-w-md text-[14px] leading-relaxed text-mute">
        Choose a request and how hard to push it, then start the run. Response
        times, throughput and errors update here every quarter second.
      </p>
    </Card>
  );
}

function LoadResults({ run }: Readonly<{ run: LoadRun }>) {
  const snapshot = run.snapshot;
  const state = stateLabel(snapshot);
  const progress = progressOf(run, snapshot);
  const latency = snapshot?.latency ?? null;
  const total = snapshot?.total ?? 0;
  const failed = snapshot?.failed ?? 0;
  const running = !snapshot || snapshot.state === "running";
  const points = settledPoints(run);

  return (
    <div className="flex flex-col gap-5">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <span className="truncate">{run.requestName}</span>
          </CardTitle>
          <CardDescription className="tabular-nums">
            {run.config.virtualUsers}{" "}
            {run.config.virtualUsers === 1 ? "user" : "users"} ·{" "}
            {run.config.limitKind === "duration"
              ? `${run.config.durationSeconds} s`
              : `${formatCount(run.config.requestCount)} requests`}
            {run.environmentName ? ` · ${run.environmentName}` : ""} ·{" "}
            {formatElapsed(snapshot?.elapsedMs ?? 0)} elapsed
            {running && snapshot ? ` · ${snapshot.activeUsers} active` : ""}
          </CardDescription>
          <CardAction>
            <Pill variant={state.variant}>
              {running ? (
                <Activity className="animate-pulse" aria-hidden />
              ) : null}
              {state.text}
            </Pill>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Run progress"
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <span
              className="block h-full rounded-full bg-vio transition-[width] duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              label="Requests"
              value={formatCount(total)}
              detail={formatBytes(snapshot?.bytes ?? 0)}
            />
            <Metric
              label="Throughput"
              value={`${formatRate(snapshot?.requestsPerSecond ?? 0)}/s`}
              detail={`peak ${formatCount(peakRate(run))}/s`}
            />
            <Metric
              label="Failed"
              value={formatPercent(failed, total)}
              detail={`${formatCount(failed)} of ${formatCount(total)}`}
              tone={failed > 0 ? "bad" : undefined}
            />
            <Metric
              label="Median"
              value={latency ? formatMs(latency.p50) : "–"}
              detail={latency ? `mean ${formatMs(latency.mean)}` : undefined}
            />
            <Metric
              label="95th percentile"
              value={latency ? formatMs(latency.p95) : "–"}
              detail={latency ? `p90 ${formatMs(latency.p90)}` : undefined}
            />
            <Metric
              label="99th percentile"
              value={latency ? formatMs(latency.p99) : "–"}
              detail={
                latency
                  ? `${formatMs(latency.min)} – ${formatMs(latency.max)}`
                  : undefined
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Response time</CardTitle>
            <CardDescription>
              Per second, for responses received
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoadTimeline mode="latency" points={points} />
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Throughput</CardTitle>
            <CardDescription>Requests finished each second</CardDescription>
          </CardHeader>
          <CardContent>
            <LoadTimeline mode="throughput" points={points} />
          </CardContent>
        </Card>
      </div>

      {snapshot && total > 0 ? (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Responses</CardTitle>
            <CardDescription>
              Status codes and connection errors
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <StatusBreakdown snapshot={snapshot} />
            <ErrorList snapshot={snapshot} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default LoadResults;
