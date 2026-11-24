import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Circular icon well used in stat cards and list rows. */
function IconWell({
  icon: Icon,
  size = "md",
  className,
}: Readonly<{ icon: LucideIcon; size?: "md" | "lg"; className?: string }>) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-surface-icon text-ink",
        size === "lg" ? "size-12" : "size-11",
        className,
      )}
    >
      <Icon className="size-4.5" strokeWidth={1.8} />
    </span>
  );
}

export default IconWell;
