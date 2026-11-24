import { cn } from "@/lib/utils";

function TitleBar() {
  const bridge = window.aurolis;
  if (!bridge) return null;

  const isMac = bridge.platform === "darwin";

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center justify-center border-b border-line bg-background select-none [-webkit-app-region:drag]",
        isMac ? "pr-3 pl-19.5" : "pr-35 pl-3",
      )}
    >
      <span className="text-[12.5px] font-medium text-dim">Aurolis</span>
    </div>
  );
}

export default TitleBar;
