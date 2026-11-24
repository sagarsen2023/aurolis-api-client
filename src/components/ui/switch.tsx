import type { ComponentProps } from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-line bg-track transition-colors outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40 data-checked:border-transparent data-checked:bg-lav",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform",
          "data-checked:translate-x-[1.3rem]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
