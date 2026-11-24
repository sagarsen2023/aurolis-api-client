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
    <section
      id={id}
      className="animate-in duration-700 ease-out fill-mode-both fade-in slide-in-from-bottom-3"
    >
      <h2 className="animate-in text-[22px] font-medium tracking-[-0.02em] text-foreground duration-700 fill-mode-both fade-in">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 max-w-2xl animate-in text-sm leading-relaxed text-mute delay-100 duration-700 fill-mode-both fade-in">
          {description}
        </p>
      ) : null}
      <div className="mt-4 animate-in delay-150 duration-700 fill-mode-both fade-in slide-in-from-bottom-2">
        {children}
      </div>
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
