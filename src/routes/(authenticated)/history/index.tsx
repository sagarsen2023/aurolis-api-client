import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(authenticated)/history/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <h1 className="text-2xl font-semibold tracking-tight">History</h1>;
}
