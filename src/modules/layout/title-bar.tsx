import { cn } from "@/lib/utils";

function TitleBar() {
  const bridge = window.aurolis;
  if (!bridge) return null;

  const isMac = bridge.platform === "darwin";

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 select-none items-center justify-center border-b border-line bg-background [-webkit-app-region:drag]",
        isMac ? "pl-19.5 pr-3" : "pl-3 pr-35",
      )}
    >
      <span className="text-[12.5px] font-medium text-dim">Aurolis</span>
    </div>
  );
}

export default TitleBar;
