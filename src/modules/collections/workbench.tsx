import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useSaveShortcuts } from "@/hooks/use-save-shortcuts";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import TreeDialogs from "./dialogs/tree-dialogs";
import EditorPane from "./editor/editor-pane";
import CollectionTree from "./tree/collection-tree";

function CollectionsWorkbench({
  workspace,
}: Readonly<{ workspace: OpenedWorkspace }>) {
  useSaveShortcuts();
  const collections = workspace.data?.collections ?? [];
  return (
    <>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize="24" minSize={220} maxSize="45">
          <CollectionTree collections={collections} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel minSize="40">
          <EditorPane collections={collections} />
        </ResizablePanel>
      </ResizablePanelGroup>
      <TreeDialogs />
    </>
  );
}

export default CollectionsWorkbench;
