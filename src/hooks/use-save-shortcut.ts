import { useEffect, useLayoutEffect, useRef } from "react";

function isSaveShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
}

export function useSaveShortcut(onSave: (event: KeyboardEvent) => void) {
  const latest = useRef(onSave);
  useLayoutEffect(() => {
    latest.current = onSave;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSaveShortcut(event)) return;
      event.preventDefault();
      latest.current(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
