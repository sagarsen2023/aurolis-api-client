import { cn } from "@/lib/utils";
import { METHOD_TEXT_CLASS, PROTOCOL_OPTIONS } from "@/constants/request";
import type { ApiRequest } from "@/types/workspace/request.type";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";

function RequestBadge({
  request,
  className,
}: Readonly<{ request: ApiRequest | SavedRequest; className?: string }>) {
  if (request.protocol === "http") {
    return (
      <span
        className={cn(
          "w-11 shrink-0 font-mono text-[10.5px] font-semibold tracking-tight",
          METHOD_TEXT_CLASS[request.method],
          className,
        )}
      >
        {request.method === "DELETE" ? "DEL" : request.method}
      </span>
    );
  }
  const option = PROTOCOL_OPTIONS.find(
    (entry) => entry.value === request.protocol,
  );
  return (
    <span
      className={cn(
        "w-11 shrink-0 font-mono text-[10.5px] font-semibold tracking-tight",
        option?.badgeClass,
        className,
      )}
    >
      {option?.badge}
    </span>
  );
}

export default RequestBadge;
