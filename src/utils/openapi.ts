import { strToU8 } from "fflate";
import { buildOpenApi } from "@/lib/openapi";
import { slugify } from "@/lib/workspace-format";
import type {
  ExportFile,
  ExportSelection,
} from "@/types/transfer/transfer.type";
import type { Environment } from "@/types/workspace/environment.type";

export function exportOpenApi(
  selection: ExportSelection,
  environment: Environment | null,
): ExportFile {
  const single =
    selection.collections.length === 1 ? selection.collections[0] : null;
  const title = single?.name ?? selection.workspaceName;
  const result = buildOpenApi(selection.collections, {
    title,
    description: single?.description,
    environment,
  });
  return {
    name: `${slugify(title, "api")}.openapi.json`,
    bytes: strToU8(`${JSON.stringify(result.document, null, 2)}\n`),
    skippedRequests: result.skippedRequests,
  };
}
