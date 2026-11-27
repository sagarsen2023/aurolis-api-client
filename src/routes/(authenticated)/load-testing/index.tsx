import { createFileRoute } from "@tanstack/react-router";
import LoadTestingPage from "@/modules/load-testing/load-testing-page";

export const Route = createFileRoute("/(authenticated)/load-testing/")({
  component: LoadTestingPage,
});
