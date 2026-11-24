import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(authenticated)/load-testing/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <h1 className="text-2xl font-semibold tracking-tight">Load testing</h1>
  );
}
