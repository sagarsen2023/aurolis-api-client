import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import IconWell from "./icon-well";

/** Icon well, title over a muted line, and a trailing action. */
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
    <li className="flex items-center gap-4 py-3">
      <IconWell icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-foreground">{title}</p>
        <p className="truncate text-[13.5px] text-mute">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  );
}

export default ListRow;
