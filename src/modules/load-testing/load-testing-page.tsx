import { useState } from "react";
import { useAtomValue } from "jotai";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { loadRunAtom, type LoadRun } from "@/context/load-testing-context";
import WorkspaceGate from "@/modules/workspace/workspace-gate";
import LoadConfigCard from "./load-config-card";
import LoadHistory from "./load-history";
import LoadResults, { LoadResultsEmpty } from "./load-results";

const LAYOUT = "grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]";

function LoadTestingWorkbench() {
  const current = useAtomValue(loadRunAtom);
  const [viewed, setViewed] = useState<{
    over: string | undefined;
    run: LoadRun;
  } | null>(null);
  const shown = viewed && viewed.over === current?.runId ? viewed.run : current;

  return (
    <div className={LAYOUT}>
      <div className="flex flex-col gap-5 lg:sticky lg:top-0">
        <LoadConfigCard />
        <LoadHistory
          selectedRunId={shown?.runId ?? null}
          onSelect={(run) =>
            setViewed(
              run.runId === current?.runId
                ? null
                : { over: current?.runId, run },
            )
          }
        />
      </div>
      {shown ? <LoadResults run={shown} /> : <LoadResultsEmpty />}
    </div>
  );
}

function LoadTestingSkeleton() {
  return (
    <div className={LAYOUT}>
      <Skeleton className="h-130 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

function LoadTestingPage() {
  return (
    <div className="mx-auto flex w-full max-w-310 flex-col gap-6 px-8 pt-8 pb-12">
      <PageHeader
        title="Load testing"
        description="Send a request many times from this computer and watch response times, throughput and errors as the run goes."
      />
      <WorkspaceGate loading={<LoadTestingSkeleton />}>
        {() => <LoadTestingWorkbench />}
      </WorkspaceGate>
    </div>
  );
}

export default LoadTestingPage;
