import { cn } from "@/lib/utils";
import type {
  ChangedFile,
  DiffLine,
} from "@/types/workspace/source-control.type";

const ROW_CLASS: Record<DiffLine["kind"], string> = {
  hunk: "bg-vio/8 text-dim",
  add: "bg-success/12",
  delete: "bg-danger/12",
  context: "",
};

const MARKER: Record<DiffLine["kind"], string> = {
  hunk: "",
  add: "+",
  delete: "−",
  context: " ",
};

function LineNumber({ value }: Readonly<{ value: number | null }>) {
  return (
    <td className="w-10 border-r border-line px-2 text-right align-top text-dim select-none">
      {value ?? ""}
    </td>
  );
}

function DiffView({ file }: Readonly<{ file: ChangedFile }>) {
  if (file.binary) {
    return (
      <p className="px-4 py-3 text-[12.5px] text-mute">
        Binary file, not shown.
      </p>
    );
  }
  if (file.lines.length === 0) {
    return (
      <p className="px-4 py-3 text-[12.5px] text-mute">No content changes.</p>
    );
  }
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full border-collapse font-mono text-[12px] leading-5">
        <tbody>
          {file.lines.map((line, index) =>
            line.kind === "hunk" ? (
              <tr key={index} className={ROW_CLASS.hunk}>
                <td colSpan={4} className="px-3 py-0.5">
                  {line.text}
                </td>
              </tr>
            ) : (
              <tr key={index} className={ROW_CLASS[line.kind]}>
                <LineNumber value={line.oldLine} />
                <LineNumber value={line.newLine} />
                <td
                  className={cn(
                    "w-5 text-center select-none",
                    line.kind === "add" && "text-success",
                    line.kind === "delete" && "text-danger",
                  )}
                  aria-label={line.kind === "context" ? undefined : line.kind}
                >
                  {MARKER[line.kind]}
                </td>
                <td className="pr-3 break-all whitespace-pre-wrap text-code">
                  {line.text}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {file.truncated ? (
        <p className="border-t border-line px-4 py-2 text-[12px] text-mute">
          The diff is long, so only the first part is shown.
        </p>
      ) : null}
    </div>
  );
}

export default DiffView;
