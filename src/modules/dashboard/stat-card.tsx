import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card size="sm" className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[220px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <IconWell icon={icon} />
        </CardAction>
      </CardHeader>
      <CardFooter className="text-sm text-muted-foreground">{badge}</CardFooter>
    </Card>
  );
}

export default StatCard;
