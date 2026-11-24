import SettingsModule from "@/modules/settings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(authenticated)/settings/")({
  component: SettingsModule,
});
