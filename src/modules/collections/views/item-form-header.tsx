import type { ReactNode } from "react";
import { RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function ItemFormHeader({
  icon,
  eyebrow,
  name,
  onNameChange,
  isDirty,
  saving,
  canSave,
  onSave,
  onDiscard,
  onDelete,
}: Readonly<{
  icon: ReactNode;
  eyebrow: string;
  name: string;
  onNameChange: (name: string) => void;
  isDirty: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onDelete: () => void;
}>) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-center gap-1.5 text-[12px] text-dim">
          {icon}
          {eyebrow}
        </p>
        <input
          aria-label="Name"
          value={name}
          maxLength={200}
          onChange={(event) => onNameChange(event.target.value)}
          className="h-8 min-w-0 rounded-lg border border-transparent bg-transparent px-1.5 text-[17px] font-medium tracking-[-0.01em] text-foreground outline-none hover:border-line focus-visible:border-ring"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isDirty ? (
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            <RotateCcw />
            Discard changes
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Delete"
        >
          <Trash2 />
        </Button>
        <Button
          size="sm"
          variant={isDirty ? "default" : "outline"}
          disabled={!isDirty || saving || !canSave}
          onClick={onSave}
        >
          <Save />
          {isDirty ? "Save" : "Saved"}
        </Button>
      </div>
    </div>
  );
}

export default ItemFormHeader;
