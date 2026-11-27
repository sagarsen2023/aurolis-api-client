import { useAtomValue } from "jotai";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadHistoryAtom, type LoadRun } from "@/context/load-testing-context";
import { cn } from "@/lib/utils";
import { formatCount, formatMs, formatPercent, formatRate } from "./format";

function LoadHistory({
  selectedRunId,
  onSelect,
}: Readonly<{
  selectedRunId: string | null;
  onSelect: (run: LoadRun) => void;
}>) {
  const history = useAtomValue(loadHistoryAtom);
  if (history.length === 0) return null;

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Earlier runs</CardTitle>
        <CardDescription>
          Kept until you close Aurolis. Select one to see its results.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3">
        <ul className="flex flex-col gap-0.5">
          {history.map((run) => {
            const snapshot = run.snapshot;
            return (
              <li key={run.runId}>
                <button
                  type="button"
                  aria-pressed={selectedRunId === run.runId}
                  onClick={() => onSelect(run)}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-hover",
                    selectedRunId === run.runId && "bg-surface-2",
                  )}
                >
                  <span className="truncate text-sm text-foreground">
                    {run.requestName}
                  </span>
                  <span className="text-xs text-dim tabular-nums">
                    {new Date(run.startedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="col-span-2 truncate text-xs text-mute tabular-nums">
                    {run.config.virtualUsers}{" "}
                    {run.config.virtualUsers === 1 ? "user" : "users"} ·{" "}
                    {formatCount(snapshot?.total ?? 0)} requests ·{" "}
                    {formatRate(snapshot?.requestsPerSecond ?? 0)}/s · p95{" "}
                    {snapshot?.latency ? formatMs(snapshot.latency.p95) : "–"} ·{" "}
                    {formatPercent(snapshot?.failed ?? 0, snapshot?.total ?? 0)}{" "}
                    failed
                    {snapshot?.state === "stopped" ? " · stopped" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export default LoadHistory;
