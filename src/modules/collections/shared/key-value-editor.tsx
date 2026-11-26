import { Lock, LockOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { KeyValue } from "@/types/workspace/request.type";

type Row = KeyValue & { secret?: boolean };

const CELL =
  "h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 font-mono text-[12.5px] text-foreground outline-none placeholder:text-dim hover:border-line focus-visible:border-ring focus-visible:bg-input/30";

const BOXED_CELL =
  "h-9 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface-2 px-3 font-mono text-[12.5px] text-foreground outline-none placeholder:text-dim focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

const EMPTY_ROW: Row = { key: "", value: "", enabled: true };

function isBlank(row: Row) {
  return !row.key && !row.value;
}

function withTrailingRow(rows: Row[]) {
  const last = rows.at(-1);
  return last && isBlank(last) ? rows : [...rows, EMPTY_ROW];
}

function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  label,
  secrets = false,
  boxed = false,
}: Readonly<{
  rows: Row[];
  onChange: (rows: Row[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  label: string;
  secrets?: boolean;
  boxed?: boolean;
}>) {
  const visible = withTrailingRow(rows);
  const columns = secrets
    ? "grid-cols-[28px_1fr_1.4fr_32px_32px]"
    : "grid-cols-[28px_1fr_1.4fr_32px]";
  const cell = boxed ? BOXED_CELL : CELL;

  const commit = (next: Row[]) => onChange(next.filter((row) => !isBlank(row)));

  const updateRow = (index: number, patch: Partial<Row>) => {
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
        className={cn(
          "grid items-center gap-1 px-1 pb-1.5 text-[11.5px] font-medium text-dim",
          boxed ? "gap-2 text-[12.5px]" : "border-b border-line",
          columns,
        )}
      >
        <span role="columnheader">
          <span className="sr-only">Enabled</span>
        </span>
        <span role="columnheader" className={boxed ? "px-3" : "px-2"}>
          {keyPlaceholder}
        </span>
        <span role="columnheader" className={boxed ? "px-3" : "px-2"}>
          {valuePlaceholder}
        </span>
        {secrets ? (
          <span role="columnheader">
            <span className="sr-only">Secret</span>
          </span>
        ) : null}
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
              "grid items-center gap-1 px-1 py-0.5",
              boxed ? "gap-2" : "border-b border-line/60",
              columns,
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
            <Input
              role="cell"
              aria-label={`${keyPlaceholder} ${index + 1}`}
              className={cell}
              placeholder={keyPlaceholder}
              value={row.key}
              spellCheck={false}
              onChange={(event) =>
                updateRow(index, { key: event.target.value })
              }
            />
            <Input
              role="cell"
              aria-label={`${valuePlaceholder} ${index + 1}`}
              className={cell}
              placeholder={valuePlaceholder}
              value={row.value}
              type={row.secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) =>
                updateRow(index, { value: event.target.value })
              }
            />
            {secrets ? (
              <span role="cell" className="grid place-items-center">
                {placeholderRow ? null : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Secret ${row.key || "row"}`}
                    aria-pressed={row.secret === true}
                    title={
                      row.secret
                        ? "Secret: kept on this computer, never committed"
                        : "Mark as secret"
                    }
                    className={cn(row.secret && "text-vio")}
                    onClick={() => updateRow(index, { secret: !row.secret })}
                  >
                    {row.secret ? <Lock /> : <LockOpen />}
                  </Button>
                )}
              </span>
            ) : null}
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
