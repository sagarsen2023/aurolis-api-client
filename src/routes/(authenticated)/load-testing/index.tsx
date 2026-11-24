import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/(authenticated)/load-testing/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto w-full max-w-310 px-8 pt-8 pb-12">
      <PageHeader
        title="Load testing"
        description="Run a request many times and watch how it holds up."
      />
    </div>
  );
}
