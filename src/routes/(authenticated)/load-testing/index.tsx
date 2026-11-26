import { createFileRoute } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/(authenticated)/load-testing/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto flex w-full max-w-310 flex-col gap-6 px-8 pt-8 pb-12">
      <PageHeader
        title="Load testing"
        description="Run a request many times and watch how it holds up."
      />
      <ComingSoon
        icon={Gauge}
        title="Load testing isn't ready yet"
        description="You'll be able to send a request many times from this computer and follow response times and errors as the run goes."
      />
    </div>
  );
}
