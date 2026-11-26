import {
  FileText,
  Folder as FolderIcon,
  Globe,
  Layers,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { CHANGE_STATUS } from "@/constants/source-control";
import { cn } from "@/lib/utils";
import RequestBadge from "@/modules/collections/shared/request-badge";
import type {
  ChangedItem,
  ChangedItemKind,
  ChangeGroup as ChangeGroupData,
  ChangeGroupKind,
} from "@/types/workspace/source-control.type";

const KIND_ICON: Record<Exclude<ChangedItemKind, "request">, LucideIcon> = {
  workspace: Settings2,
  collection: Layers,
  folder: FolderIcon,
  example: FileText,
  environment: Globe,
  globals: Globe,
  file: FileText,
};

const KIND_LABEL: Partial<Record<ChangedItemKind, string>> = {
  collection: "Collection settings",
  folder: "Folder",
  example: "Example",
};

const GROUP_ICON: Record<ChangeGroupKind, LucideIcon> = {
  collection: Layers,
  environments: Globe,
  workspace: Settings2,
};

function ItemIcon({ item }: Readonly<{ item: ChangedItem }>) {
  if (item.kind === "request" && item.protocol) {
    return (
      <RequestBadge
        request={{ protocol: item.protocol, method: item.method }}
        className="w-11"
      />
    );
  }
  const Icon = KIND_ICON[item.kind === "request" ? "file" : item.kind];
  return (
    <span className="grid w-11 shrink-0 place-items-start">
      <Icon className="size-3.5 text-dim" aria-hidden />
    </span>
  );
}

function ChangedItemRow({ item }: Readonly<{ item: ChangedItem }>) {
  const status = CHANGE_STATUS[item.status];
  const kindLabel = KIND_LABEL[item.kind];
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <ItemIcon item={item} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2 text-[13px] text-foreground">
          <span className="truncate">{item.name}</span>
          {item.previousName ? (
            <span className="truncate text-[12px] text-dim">
              was {item.previousName}
            </span>
          ) : null}
        </span>
        {item.location.length > 0 || kindLabel ? (
          <span className="truncate text-[12px] text-dim">
            {[kindLabel, item.location.join(" / ")].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-md bg-surface-raise px-1.5 py-0.5 font-mono text-[11px] font-semibold",
          status.className,
        )}
        title={status.label}
      >
        {status.letter}
        <span className="sr-only">{status.label}</span>
      </span>
    </li>
  );
}

function ChangeGroup({ group }: Readonly<{ group: ChangeGroupData }>) {
  const Icon = GROUP_ICON[group.kind];
  return (
    <li>
      <div className="flex items-center gap-2 border-b border-line bg-surface-raise/50 px-3.5 py-2 text-[13px] font-medium text-foreground">
        <Icon className="size-3.5 shrink-0 text-vio" aria-hidden />
        <span className="truncate">{group.name}</span>
        <span className="ml-auto font-normal text-dim tabular-nums">
          {group.items.length}
        </span>
      </div>
      <ul className="divide-y divide-line/70">
        {group.items.map((item) => (
          <ChangedItemRow key={item.key} item={item} />
        ))}
      </ul>
    </li>
  );
}

export default ChangeGroup;
