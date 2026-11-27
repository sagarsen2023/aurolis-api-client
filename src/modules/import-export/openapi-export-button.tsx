import { useAtomValue } from "jotai";
import { SiSwagger } from "react-icons/si";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  activeWorkspaceAtom,
  currentEnvironmentAtom,
} from "@/context/workspace-context";
import { usePromise } from "@/hooks/usePromise";
import { transferService } from "@/services/transfer.service";
import type { Collection } from "@/types/workspace/collection.type";
import { exportOpenApi } from "@/utils/openapi";

function skippedNote(skipped: number) {
  if (skipped === 0) return undefined;
  return `${skipped} WebSocket or Socket.IO ${skipped === 1 ? "request isn't" : "requests aren't"} in it: OpenAPI describes HTTP APIs.`;
}

function OpenApiExportButton({
  collection,
}: Readonly<{ collection: Collection }>) {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const environment = useAtomValue(currentEnvironmentAtom);

  const { loading, runPromise } = usePromise({
    promise: async () => {
      const file = exportOpenApi(
        {
          workspaceId: workspace?.entry.id ?? "",
          workspaceName: workspace?.entry.name ?? collection.name,
          collections: [collection],
          environments: [],
        },
        environment,
      );
      const saved = await transferService.saveFile(file);
      return { saved, skipped: file.skippedRequests };
    },
    onSuccess: ({ saved, skipped }) => {
      if (!saved.saved) return;
      toast.success("Swagger docs exported", {
        description: [saved.path, skippedNote(skipped)]
          .filter(Boolean)
          .join(" "),
      });
    },
  });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Export as Swagger docs"
            disabled={loading}
            onClick={() => void runPromise()}
          />
        }
      >
        {loading ? <Spinner /> : <SiSwagger aria-hidden />}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Export as Swagger docs (OpenAPI 3.0 JSON)
      </TooltipContent>
    </Tooltip>
  );
}

export default OpenApiExportButton;
