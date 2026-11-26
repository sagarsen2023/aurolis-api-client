import type { ReactNode } from "react";
import { isModEnter } from "@/utils/platform";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

function SplitLayout({
  top,
  bottom,
  onModEnter,
}: Readonly<{ top: ReactNode; bottom: ReactNode; onModEnter?: () => void }>) {
  return (
    <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
      <ResizablePanel
        defaultSize="55"
        minSize="20"
        className="flex min-h-0 flex-col"
      >
        <div
          className="flex min-h-0 flex-1 flex-col"
          onKeyDown={(event) => {
            if (!onModEnter || !isModEnter(event)) return;
            event.preventDefault();
            onModEnter();
          }}
        >
          {top}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize="45"
        minSize="15"
        className="flex min-h-0 flex-col"
      >
        {bottom}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default SplitLayout;
