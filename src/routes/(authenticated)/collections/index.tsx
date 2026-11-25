import { createFileRoute } from "@tanstack/react-router";
import CollectionsPage from "@/modules/collections/collections-page";

type CollectionsSearch = { request?: string };

export const Route = createFileRoute("/(authenticated)/collections/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CollectionsSearch =>
    typeof search.request === "string" ? { request: search.request } : {},
});

function RouteComponent() {
  const { request } = Route.useSearch();
  return <CollectionsPage requestId={request} />;
}
