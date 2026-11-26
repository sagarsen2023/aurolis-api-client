import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: Readonly<{
  icon: LucideIcon;
  title: string;
  description: ReactNode;
}>) {
  return (
    <Card displayGradient className="items-center gap-4 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-icon text-vio ring-8 ring-surface-2">
        <Icon className="size-6" strokeWidth={1.6} aria-hidden />
      </span>
      <Pill variant="lav">Coming soon</Pill>
      <h2 className="text-[22px] leading-tight font-medium tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      <p className="max-w-md text-[14px] leading-relaxed text-mute">
        {description}
      </p>
    </Card>
  );
}
