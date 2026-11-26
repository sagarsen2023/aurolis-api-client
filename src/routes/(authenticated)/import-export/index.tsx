import { createFileRoute } from "@tanstack/react-router";
import ImportExportPage from "@/modules/import-export/import-export-page";

export const Route = createFileRoute("/(authenticated)/import-export/")({
  component: ImportExportPage,
});
