import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { KeyValue } from "@/types/workspace/request.type";

const CELL =
  "h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 font-mono text-[12.5px] text-foreground outline-none placeholder:text-dim hover:border-line focus-visible:border-ring focus-visible:bg-input/30";

const EMPTY_ROW: KeyValue = { key: "", value: "", enabled: true };

function isBlank(row: KeyValue) {
  return !row.key && !row.value;
}

function withTrailingRow(rows: KeyValue[]) {
  const last = rows.at(-1);
  return last && isBlank(last) ? rows : [...rows, EMPTY_ROW];
}

function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  label,
}: Readonly<{
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  label: string;
}>) {
  const visible = withTrailingRow(rows);

  const commit = (next: KeyValue[]) =>
    onChange(next.filter((row) => !isBlank(row)));

  const updateRow = (index: number, patch: Partial<KeyValue>) => {
    const next = visible.map((row, position) =>
      position === index ? { ...row, ...patch } : row,
    );
    commit(next);
  };

  const removeRow = (index: number) =>
    commit(visible.filter((_, position) => position !== index));

  return (
    <div role="table" aria-label={label} className="flex flex-col">
      <div
        role="row"
        className="grid grid-cols-[28px_1fr_1.4fr_32px] items-center gap-1 border-b border-line px-1 pb-1.5 text-[11.5px] font-medium text-dim"
      >
        <span role="columnheader">
          <span className="sr-only">Enabled</span>
        </span>
        <span role="columnheader" className="px-2">
          {keyPlaceholder}
        </span>
        <span role="columnheader" className="px-2">
          {valuePlaceholder}
        </span>
        <span role="columnheader">
          <span className="sr-only">Remove</span>
        </span>
      </div>
      {visible.map((row, index) => {
        const placeholderRow = index === visible.length - 1 && isBlank(row);
        return (
          <div
            role="row"
            key={index}
            className={cn(
              "grid grid-cols-[28px_1fr_1.4fr_32px] items-center gap-1 border-b border-line/60 px-1 py-0.5",
              !row.enabled && "opacity-55",
            )}
          >
            <span role="cell" className="grid place-items-center">
              {placeholderRow ? null : (
                <Checkbox
                  aria-label={`Enable ${row.key || "row"}`}
                  checked={row.enabled}
                  onCheckedChange={(checked) =>
                    updateRow(index, { enabled: checked === true })
                  }
                />
              )}
            </span>
            <input
              role="cell"
              aria-label={`${keyPlaceholder} ${index + 1}`}
              className={CELL}
              placeholder={keyPlaceholder}
              value={row.key}
              spellCheck={false}
              onChange={(event) =>
                updateRow(index, { key: event.target.value })
              }
            />
            <input
              role="cell"
              aria-label={`${valuePlaceholder} ${index + 1}`}
              className={CELL}
              placeholder={valuePlaceholder}
              value={row.value}
              spellCheck={false}
              onChange={(event) =>
                updateRow(index, { value: event.target.value })
              }
            />
            <span role="cell" className="grid place-items-center">
              {placeholderRow ? null : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${row.key || "row"}`}
                  onClick={() => removeRow(index)}
                >
                  <Trash2 />
                </Button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default KeyValueEditor;
