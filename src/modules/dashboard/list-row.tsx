import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import IconWell from "./icon-well";

function ListRow({
  icon,
  title,
  description,
  action,
}: Readonly<{
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}>) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <IconWell icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  );
}

export default ListRow;
