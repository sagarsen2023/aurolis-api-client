import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  size = "default",
  className,
}: Readonly<{
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  size?: "default" | "display" | "compact";
  className?: string;
}>) {
  const compact = size === "compact";
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[13px] font-medium text-vio">{eyebrow}</p>
        ) : null}
        <h1
          className={cn(
            "text-foreground",
            eyebrow && "mt-1",
            compact
              ? "text-2xl font-semibold tracking-tight"
              : size === "display"
                ? "text-[clamp(30px,3.6vw,44px)] leading-[1.05] font-medium tracking-[-0.045em]"
                : "text-[32px] leading-none font-medium tracking-[-0.04em]",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "max-w-xl",
              compact
                ? "mt-1 text-sm text-muted-foreground"
                : "mt-2 text-[13.5px] leading-snug text-mute",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className={cn("flex items-center", compact ? "gap-2" : "gap-3")}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}
