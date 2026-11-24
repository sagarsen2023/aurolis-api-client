import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(authenticated)/import-export/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <h1 className="text-2xl font-semibold tracking-tight">Import & export</h1>
  );
}
