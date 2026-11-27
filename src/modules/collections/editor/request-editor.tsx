import { VariableScopeContext } from "@/context/variable-scope-context";
import { useRequestDraft } from "@/hooks/use-request-drafts";
import { useRequestVariableScope } from "@/hooks/use-variable-scope";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";
import GraphqlEditor from "./graphql/graphql-editor";
import HttpEditor from "./http/http-editor";
import RealtimeEditor from "./realtime/realtime-editor";
import RequestHeader from "./request-header";

function ProtocolEditor({
  draft,
  onChange,
}: Readonly<{
  draft: SavedRequest;
  onChange: (request: SavedRequest) => void;
}>) {
  switch (draft.protocol) {
    case "http":
      return <HttpEditor request={draft} onChange={onChange} />;
    case "graphql":
      return <GraphqlEditor request={draft} onChange={onChange} />;
    case "websocket":
    case "socketio":
      return <RealtimeEditor request={draft} onChange={onChange} />;
  }
}

function RequestEditor({ requestId }: Readonly<{ requestId: string }>) {
  const { draft, isDirty, change } = useRequestDraft(requestId);
  const scope = useRequestVariableScope(requestId);
  if (!draft) return null;
  return (
    <VariableScopeContext.Provider value={scope}>
      <div className="flex h-full min-h-0 flex-col">
        <RequestHeader draft={draft} isDirty={isDirty} onChange={change} />
        <ProtocolEditor key={draft.id} draft={draft} onChange={change} />
      </div>
    </VariableScopeContext.Provider>
  );
}

export default RequestEditor;
