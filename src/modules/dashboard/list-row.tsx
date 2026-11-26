import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import IconWell from "./icon-well";

function ListRow({
  icon,
  title,
  description,
  action,
  onOpen,
}: Readonly<{
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  onOpen?: () => void;
}>) {
  const body = (
    <>
      <IconWell icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <div className="truncate text-xs text-muted-foreground">
          {description}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </>
  );
  if (!onOpen) {
    return <li className="flex items-center gap-3 py-2.5">{body}</li>;
  }
  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        onClick={onOpen}
        className="-mx-2 h-auto w-[calc(100%+1rem)] justify-start gap-3 rounded-xl px-2 py-2.5 text-left font-normal whitespace-normal hover:bg-surface-hover"
      >
        {body}
      </Button>
    </li>
  );
}

export default ListRow;
