import { Cloud, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import ListRow from "./list-row";

const SEGMENTS = [
  {
    key: "ok",
    label: "2xx/3xx",
    className: "bg-status-2xx text-status-2xx-foreground",
  },
  {
    key: "clientError",
    label: "4xx",
    className: "bg-status-4xx text-status-4xx-foreground",
  },
  {
    key: "serverError",
    label: "5xx",
    className: "bg-status-5xx text-status-5xx-foreground",
  },
  {
    key: "timeout",
    label: "Timeouts",
    className: "bg-status-timeout text-status-timeout-foreground",
  },
] as const;

function StatusClassBar({
  counts,
}: Readonly<{ counts: typeof RESPONSE_HEALTH }>) {
  const total = SEGMENTS.reduce((sum, s) => sum + counts[s.key], 0);

  return (
    <div
      role="img"
      aria-label={
        total === 0
          ? "No requests sent yet"
          : SEGMENTS.map((s) => `${s.label}: ${counts[s.key]}`).join(", ")
      }
      className="flex h-9 w-full overflow-hidden rounded-full bg-track"
    >
      {total > 0 &&
        SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => {
          const pct = Math.round((counts[s.key] / total) * 100);
          return (
            <span
              key={s.key}
              style={{ width: `${pct}%` }}
              className={cn(
                "grid place-items-center text-[12.5px] font-medium",
                s.className,
              )}
            >
              {pct >= 10 && `${pct}%`}
            </span>
          );
        })}
    </div>
  );
}

function ResponseHealth() {
  const sent = Object.values(RESPONSE_HEALTH).reduce((a, b) => a + b, 0);

  return (
    <Card className="gap-4 [--card-spacing:--spacing(5)]">
      <CardHeader className="gap-1">
        <CardTitle className="text-xl font-medium tracking-[-0.01em]">
          Response health
        </CardTitle>
        <CardDescription className="text-[14px] text-mute">
          Status classes across {sent} sent requests
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <StatusClassBar counts={RESPONSE_HEALTH} />
        <ul className="mt-2 divide-y divide-line">
          <ListRow
            icon={Cloud}
            title="Saved to Aurolis Cloud"
            description="Press Ctrl/⌘ S to save your edits"
            action={<Pill variant="ok">All saved</Pill>}
          />
          <ListRow
            icon={Zap}
            title="No load tests yet"
            description="Stress any request with virtual users"
            action={
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3.5 text-[13.5px]"
              >
                Run
              </Button>
            }
          />
        </ul>
      </CardContent>
    </Card>
  );
}

export default ResponseHealth;
