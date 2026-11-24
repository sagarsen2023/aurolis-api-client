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
  size?: "default" | "display";
  className?: string;
}>) {
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
            "font-medium text-foreground",
            eyebrow && "mt-1",
            size === "display"
              ? "text-[clamp(30px,3.6vw,44px)] leading-[1.05] tracking-[-0.045em]"
              : "text-[32px] leading-none tracking-[-0.04em]",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-[13.5px] leading-snug text-mute">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
