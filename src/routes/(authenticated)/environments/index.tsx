import { createFileRoute } from "@tanstack/react-router";
import EnvironmentsPage from "@/modules/environments/environments-page";

export const Route = createFileRoute("/(authenticated)/environments/")({
  component: EnvironmentsPage,
});
