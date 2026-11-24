import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsSection({
  id,
  title,
  description,
  children,
}: Readonly<{
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}>) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-[22px] font-medium tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-mute">
          {description}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsGroup({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-line bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SettingRow({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
}>) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line px-5 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[15px] text-foreground">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-snug text-mute">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
