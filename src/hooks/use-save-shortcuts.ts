import { useEffect, useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import { handleError } from "./usePromise";
import { useEditorTabs } from "./use-editor-tabs";
import { useSaveRequests } from "./use-request-drafts";

function isSaveShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
}

export function useSaveShortcuts() {
  const { activeTab } = useEditorTabs();
  const { saveRequest, saveAll } = useSaveRequests();
  const latest = useRef({ activeTab, saveRequest, saveAll });
  useLayoutEffect(() => {
    latest.current = { activeTab, saveRequest, saveAll };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSaveShortcut(event)) return;
      event.preventDefault();
      const current = latest.current;
      if (event.shiftKey) {
        current.saveAll().catch(handleError);
        return;
      }
      if (current.activeTab?.kind !== "request") return;
      current
        .saveRequest(current.activeTab.id)
        .then((saved) => {
          if (saved) toast.success("Saved");
        })
        .catch(handleError);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
