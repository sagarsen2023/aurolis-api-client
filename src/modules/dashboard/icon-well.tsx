import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function IconWell({
  icon: Icon,
  className,
}: Readonly<{ icon: LucideIcon; className?: string }>) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export default IconWell;
