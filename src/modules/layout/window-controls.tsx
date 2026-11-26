import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

const BUTTON =
  "grid h-full w-11.5 place-items-center text-dim transition-colors duration-150 outline-none focus-visible:bg-surface-hover";

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let active = true;
    let stop: (() => void) | null = null;
    const refresh = () =>
      void appWindow
        .isMaximized()
        .then((value) => {
          if (active) setMaximized(value);
        })
        .catch(() => undefined);
    refresh();
    void appWindow
      .onResized(refresh)
      .then((unlisten) => {
        if (active) stop = unlisten;
        else unlisten();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      stop?.();
    };
  }, []);

  const appWindow = getCurrentWindow();
  return (
    <div className="flex h-full shrink-0">
      <button
        type="button"
        aria-label="Minimize"
        className={cn(BUTTON, "hover:bg-surface-hover hover:text-ink")}
        onClick={() => void appWindow.minimize()}
      >
        <Minus className="size-3.5" strokeWidth={1.6} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={maximized ? "Restore" : "Maximize"}
        className={cn(BUTTON, "hover:bg-surface-hover hover:text-ink")}
        onClick={() => void appWindow.toggleMaximize()}
      >
        {maximized ? (
          <Copy className="size-3 -scale-x-100" strokeWidth={1.6} aria-hidden />
        ) : (
          <Square className="size-3" strokeWidth={1.6} aria-hidden />
        )}
      </button>
      <button
        type="button"
        aria-label="Close"
        className={cn(BUTTON, "hover:bg-[#e81123] hover:text-white")}
        onClick={() => void appWindow.close()}
      >
        <X className="size-3.5" strokeWidth={1.6} aria-hidden />
      </button>
    </div>
  );
}

export default WindowControls;
