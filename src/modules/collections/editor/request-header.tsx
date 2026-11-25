import { useAtomValue } from "jotai";
import { ChevronRight, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { useSaveRequests } from "@/hooks/use-request-drafts";
import { usePromise } from "@/hooks/usePromise";
import { locateRequest } from "@/lib/collection-ops";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";
import { toast } from "sonner";
import { MOD_KEY } from "@/utils/platform";
import RequestBadge from "../shared/request-badge";

function RequestHeader({
  draft,
  isDirty,
  onChange,
}: Readonly<{
  draft: SavedRequest;
  isDirty: boolean;
  onChange: (request: SavedRequest) => void;
}>) {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const { saveRequest, discard } = useSaveRequests();
  const location = locateRequest(workspace?.data ?? null, draft.id);
  const path = location
    ? [
        location.collection.name,
        ...location.folders.map((folder) => folder.name),
      ]
    : [];

  const { loading: saving, runPromise: save } = usePromise({
    promise: () => saveRequest(draft.id),
    onSuccess: (saved) => {
      if (saved) toast.success("Saved");
    },
  });

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <nav
          aria-label="Location"
          className="flex min-w-0 items-center gap-1 text-[12px] text-dim"
        >
          {path.map((segment, index) => (
            <span
              key={`${segment}-${index}`}
              className="flex min-w-0 items-center gap-1"
            >
              {index > 0 ? (
                <ChevronRight className="size-3 shrink-0" aria-hidden />
              ) : null}
              <span className="truncate">{segment}</span>
            </span>
          ))}
        </nav>
        <div className="flex min-w-0 items-center gap-2">
          <RequestBadge request={draft} className="w-auto" />
          <input
            aria-label="Request name"
            value={draft.name}
            maxLength={200}
            onChange={(event) =>
              onChange({ ...draft, name: event.target.value })
            }
            className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 text-[17px] font-medium tracking-[-0.01em] text-foreground outline-none hover:border-line focus-visible:border-ring"
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isDirty ? (
          <Button variant="ghost" size="sm" onClick={() => discard(draft.id)}>
            <RotateCcw />
            Discard changes
          </Button>
        ) : null}
        <Button
          variant={isDirty ? "default" : "outline"}
          size="sm"
          disabled={!isDirty || saving || !draft.name.trim()}
          onClick={() => void save()}
        >
          <Save />
          {isDirty ? "Save" : "Saved"}
          <Kbd className="ml-1 hidden bg-transparent text-current/70 md:inline-flex">
            {MOD_KEY} S
          </Kbd>
        </Button>
      </div>
    </div>
  );
}

export default RequestHeader;
