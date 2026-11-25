import { useSetAtom } from "jotai";
import { FilePlus2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { treeDialogAtom } from "@/context/collections-context";
import { useEditorTabs } from "@/hooks/use-editor-tabs";
import type { EditorTab } from "@/types/workspace/editor-state.type";
import type { Collection } from "@/types/workspace/collection.type";
import { MOD_KEY } from "@/utils/platform";
import CollectionView from "../views/collection-view";
import ExampleView from "../views/example-view";
import FolderView from "../views/folder-view";
import EditorTabs from "./editor-tabs";
import RequestEditor from "./request-editor";

function TabContent({ tab }: Readonly<{ tab: EditorTab }>) {
  switch (tab.kind) {
    case "request":
      return <RequestEditor key={tab.id} requestId={tab.id} />;
    case "example":
      return <ExampleView key={tab.id} exampleId={tab.id} />;
    case "collection":
      return <CollectionView key={tab.id} collectionId={tab.id} />;
    case "folder":
      return <FolderView key={tab.id} folderId={tab.id} />;
  }
}

function NothingOpen({ collections }: Readonly<{ collections: Collection[] }>) {
  const setDialog = useSetAtom(treeDialogAtom);
  const first = collections[0];
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Layers />
        </EmptyMedia>
        <EmptyTitle>
          {first ? "Open a request" : "Start with a collection"}
        </EmptyTitle>
        <EmptyDescription>
          {first
            ? "Pick a request from the tree, or create one. Edits stay as drafts until you save them."
            : "Collections hold your HTTP, GraphQL, WebSocket and Socket.IO requests as files in this workspace's repository."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {first ? (
          <Button
            onClick={() =>
              setDialog({
                kind: "new-request",
                parentId: first.id,
                parentName: first.name,
              })
            }
          >
            <FilePlus2 />
            New request in {first.name}
          </Button>
        ) : (
          <Button onClick={() => setDialog({ kind: "new-collection" })}>
            <Layers />
            New collection
          </Button>
        )}
        <p className="text-[12.5px] text-mute">
          <Kbd>{MOD_KEY} S</Kbd> saves · <Kbd>{MOD_KEY} Shift S</Kbd> saves all
          · <Kbd>{MOD_KEY} Enter</Kbd> sends
        </p>
      </EmptyContent>
    </Empty>
  );
}

function EditorPane({ collections }: Readonly<{ collections: Collection[] }>) {
  const { activeTab } = useEditorTabs();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorTabs />
      <div className="min-h-0 flex-1">
        {activeTab ? (
          <TabContent tab={activeTab} />
        ) : (
          <NothingOpen collections={collections} />
        )}
      </div>
    </div>
  );
}

export default EditorPane;
