import { useState } from "react";
import { FolderClosed, Globe, Layers, LockKeyhole, Upload } from "lucide-react";
import { toast } from "sonner";
import { ChoiceCard } from "@/components/choice-card";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAtomValue } from "jotai";
import { EXPORT_FORMATS, EXPORT_HINTS } from "@/constants/import-export";
import { currentEnvironmentAtom } from "@/context/workspace-context";
import { usePromise } from "@/hooks/usePromise";
import { countItems } from "@/lib/collection-ops";
import { transferService } from "@/services/transfer.service";
import type {
  ExportFormat,
  ExportSelection,
} from "@/types/transfer/transfer.type";
import type { CollectionItem } from "@/types/workspace/collection.type";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import { exportHoppscotch } from "@/utils/hoppscotch";
import { exportOpenApi } from "@/utils/openapi";
import { exportPostman } from "@/utils/postman";

const WORKSPACE_TARGET = "workspace";

const plural = (count: number, word: string) =>
  `${count.toLocaleString("en")} ${word}${count === 1 ? "" : "s"}`;

function countRealtime(items: CollectionItem[]): number {
  return items.reduce(
    (total, item) =>
      total +
      (item.type === "folder"
        ? countRealtime(item.items)
        : item.protocol === "websocket" || item.protocol === "socketio"
          ? 1
          : 0),
    0,
  );
}

function ExportPanel({ workspace }: Readonly<{ workspace: OpenedWorkspace }>) {
  const collections = workspace.data?.collections ?? [];
  const globals = workspace.data?.globals;
  const environments = [
    ...(workspace.data?.environments ?? []),
    ...(globals && globals.variables.length > 0 ? [globals] : []),
  ];
  const [chosen, setTarget] = useState(WORKSPACE_TARGET);
  const [format, setFormat] = useState<ExportFormat>("postman");
  const environment = useAtomValue(currentEnvironmentAtom);
  const openApi = format === "openapi";
  const target =
    openApi && environments.some((entry) => entry.id === chosen)
      ? WORKSPACE_TARGET
      : chosen;
  const listedEnvironments = openApi ? [] : environments;

  const selection: ExportSelection = {
    workspaceId: workspace.entry.id,
    workspaceName: workspace.entry.name,
    collections:
      target === WORKSPACE_TARGET
        ? collections
        : collections.filter((collection) => collection.id === target),
    environments:
      target === WORKSPACE_TARGET
        ? environments
        : environments.filter((environment) => environment.id === target),
  };
  const realtime = selection.collections.reduce(
    (total, collection) => total + countRealtime(collection.items),
    0,
  );

  const { loading, runPromise } = usePromise({
    promise: () => {
      const file =
        format === "openapi"
          ? exportOpenApi(selection, environment)
          : format === "hoppscotch"
            ? exportHoppscotch(selection)
            : exportPostman(selection);
      return transferService.saveFile(file);
    },
    onSuccess: (saved) => {
      if (saved.saved) toast.success("Exported", { description: saved.path });
    },
  });

  if (collections.length + environments.length === 0) {
    return (
      <Card aria-label="Export" className="gap-3 p-5">
        <h2 className="text-[17px] font-semibold text-foreground">Export</h2>
        <p className="text-[13.5px] text-mute">
          Nothing to export yet. Create or import a collection first.
        </p>
      </Card>
    );
  }

  return (
    <Card aria-label="Export" className="gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-foreground">Export</h2>
        <SegmentedControl
          label="Export as"
          value={format}
          options={EXPORT_FORMATS}
          onChange={setFormat}
        />
      </div>
      <div
        role="radiogroup"
        aria-label="What to export"
        className="flex max-h-90 flex-col gap-2 overflow-y-auto"
      >
        <ChoiceCard
          selected={target === WORKSPACE_TARGET}
          onSelect={() => setTarget(WORKSPACE_TARGET)}
          icon={Layers}
          title="Entire workspace"
          description={`${plural(collections.length, "collection")} · ${plural(environments.length, "environment")}`}
        />
        {collections.map((collection) => {
          const { requests, examples } = countItems(collection.items);
          return (
            <ChoiceCard
              key={collection.id}
              selected={target === collection.id}
              onSelect={() => setTarget(collection.id)}
              icon={FolderClosed}
              title={collection.name}
              description={[
                "Collection",
                plural(requests, "request"),
                ...(examples > 0 ? [plural(examples, "example")] : []),
              ].join(" · ")}
            />
          );
        })}
        {listedEnvironments.map((environment) => (
          <ChoiceCard
            key={environment.id}
            selected={target === environment.id}
            onSelect={() => setTarget(environment.id)}
            icon={Globe}
            title={environment.name}
            description={`Environment · ${plural(environment.variables.length, "variable")}`}
          />
        ))}
      </div>
      <p className="text-[13px] text-mute">{EXPORT_HINTS[format]}</p>
      {realtime > 0 ? (
        <p className="text-[13px] text-mute">
          {plural(realtime, "WebSocket or Socket.IO request")}{" "}
          {realtime === 1 ? "is" : "are"} left out:{" "}
          {openApi
            ? "OpenAPI describes HTTP APIs."
            : "Postman and Hoppscotch collections don't hold them."}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex flex-1 items-center gap-2 text-[12.5px] text-mute">
          <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
          Secret values stay on this computer and are never exported.
        </p>
        <Button
          className="hover:bg-lav-hover"
          disabled={loading}
          onClick={() => void runPromise()}
        >
          {loading ? <Spinner /> : <Upload />}
          Export
        </Button>
      </div>
    </Card>
  );
}

export default ExportPanel;
