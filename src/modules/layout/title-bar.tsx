import { cn } from "@/lib/utils";
import WindowControls from "./window-controls";

function TitleBar() {
  const bridge = window.aurolis;
  if (!bridge) return null;

  const isMac = bridge.platform === "darwin";

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "flex h-9 shrink-0 items-center border-b border-line bg-background select-none",
        isMac ? "justify-center pr-3 pl-19.5" : "pl-3",
      )}
    >
      <span
        data-tauri-drag-region
        className={cn(
          "text-[12.5px] font-medium text-dim",
          !isMac && "flex-1 pl-34.5 text-center",
        )}
      >
        Aurolis
      </span>
      {isMac ? null : <WindowControls />}
    </div>
  );
}

export default TitleBar;
