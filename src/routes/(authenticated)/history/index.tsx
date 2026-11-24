import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/(authenticated)/history/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto w-full max-w-310 px-8 pt-8 pb-12">
      <PageHeader
        title="History"
        description="Requests sent from this workspace."
      />
    </div>
  );
}
