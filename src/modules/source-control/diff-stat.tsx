import { DIFFSTAT_BLOCKS } from "@/constants/source-control";
import { cn } from "@/lib/utils";

function blockColors(additions: number, deletions: number) {
  const total = additions + deletions;
  if (total === 0)
    return Array.from({ length: DIFFSTAT_BLOCKS }, () => "bg-line-strong");
  const added = Math.round((additions / total) * DIFFSTAT_BLOCKS);
  const deleted = Math.min(
    DIFFSTAT_BLOCKS - added,
    Math.round((deletions / total) * DIFFSTAT_BLOCKS),
  );
  return Array.from({ length: DIFFSTAT_BLOCKS }, (_, index) => {
    if (index < added) return "bg-success";
    if (index < added + deleted) return "bg-danger";
    return "bg-line-strong";
  });
}

function DiffStat({
  additions,
  deletions,
  className,
}: Readonly<{ additions: number; deletions: number; className?: string }>) {
  return (
    <span
      className={cn("flex items-center gap-2 font-mono text-[12px]", className)}
      aria-label={`${additions} additions, ${deletions} deletions`}
    >
      <span className="text-success">+{additions}</span>
      <span className="text-danger">−{deletions}</span>
      <span className="flex gap-0.5" aria-hidden>
        {blockColors(additions, deletions).map((color, index) => (
          <span key={index} className={cn("size-2 rounded-[2px]", color)} />
        ))}
      </span>
    </span>
  );
}

export default DiffStat;
