import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import IconWell from "./icon-well";

function StatCard({
  title,
  badge,
  icon,
  value,
}: Readonly<{
  title: string;
  badge: string;
  icon: LucideIcon;
  value: number | string;
}>) {
  return (
    <Card className="min-h-37.5 justify-between gap-6 px-5 py-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] leading-6 text-foreground">{title}</h3>
        <Pill>{badge}</Pill>
      </div>
      <div className="flex items-end justify-between gap-2">
        <IconWell icon={icon} size="lg" />
        <span className="text-[62px] leading-[0.95] font-medium tracking-tighter text-foreground tabular-nums">
          {value}
        </span>
      </div>
    </Card>
  );
}

export default StatCard;
