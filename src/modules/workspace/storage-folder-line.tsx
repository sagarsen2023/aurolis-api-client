import { useState } from "react";
import { useAtom } from "jotai";
import { FolderOpen, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { STORAGE_WARNING_MESSAGES } from "@/constants/workspace";
import { registryAtom } from "@/context/workspace-context";
import { usePromise } from "@/hooks/usePromise";
import { workspaceService } from "@/services/workspace.service";
import type { StorageWarning } from "@/types/workspace/workspace-store.type";
import { formatFreeSpace } from "@/utils/format-bytes";

function StorageFolderLine() {
  const [registry, setRegistry] = useAtom(registryAtom);
  const [warnings, setWarnings] = useState<StorageWarning[]>([]);

  const { loading, runPromise: changeFolder } = usePromise({
    promise: async () => {
      const check = await workspaceService.chooseStorage();
      if (!check) return null;
      if (check.error) {
        toast.error(check.error);
        return null;
      }
      const updated = await workspaceService.setStorage("chosen");
      setRegistry(updated);
      return check;
    },
    onSuccess: (check) => {
      if (!check) return;
      setWarnings(check.warnings);
      toast.success(`Workspaces will be saved in ${check.displayPath}`);
    },
  });

  if (!registry) return null;
  const folder =
    registry.storageFolderDisplay ?? registry.defaultStorageFolder.displayPath;
  const free = registry.storageFolder
    ? null
    : formatFreeSpace(registry.defaultStorageFolder.freeBytes);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-mute">
        <FolderOpen className="size-4 text-vio" strokeWidth={1.8} aria-hidden />
        <span>
          {registry.storageFolder
            ? "Workspaces are saved in"
            : "Workspaces will be saved in"}{" "}
          <span className="font-mono text-[13px] text-foreground">
            {folder}
          </span>
          {free ? <span className="text-dim"> · {free}</span> : null}
        </span>
        <Button
          variant="ghost"
          size="xs"
          className="h-7 px-2.5 text-[13px]"
          disabled={loading}
          onClick={() => void changeFolder()}
        >
          Change…
        </Button>
      </div>
      {warnings.map((warning) => (
        <p
          key={warning}
          className="flex items-start gap-2 rounded-lg bg-warn/15 px-3 py-2 text-[13px] text-foreground"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-warning"
            aria-hidden
          />
          {STORAGE_WARNING_MESSAGES[warning]}
        </p>
      ))}
    </div>
  );
}

export default StorageFolderLine;
