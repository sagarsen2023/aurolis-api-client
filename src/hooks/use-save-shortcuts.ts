import { toast } from "sonner";
import { handleError } from "./usePromise";
import { useEditorTabs } from "./use-editor-tabs";
import { useSaveRequests } from "./use-request-drafts";
import { useSaveShortcut } from "./use-save-shortcut";

export function useSaveShortcuts() {
  const { activeTab } = useEditorTabs();
  const { saveRequest, saveAll } = useSaveRequests();

  useSaveShortcut((event) => {
    if (event.shiftKey) {
      saveAll().catch(handleError);
      return;
    }
    if (activeTab?.kind !== "request") return;
    saveRequest(activeTab.id)
      .then((saved) => {
        if (saved) toast.success("Saved");
      })
      .catch(handleError);
  });
}
