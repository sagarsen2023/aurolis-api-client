import { cn } from "@/lib/utils";
import { METHOD_TEXT_CLASS, PROTOCOL_OPTIONS } from "@/constants/request";
import type {
  HttpMethod,
  RequestProtocol,
} from "@/types/workspace/request.type";

type BadgeRequest = {
  protocol: RequestProtocol;
  method?: HttpMethod | null;
};

function RequestBadge({
  request,
  className,
}: Readonly<{ request: BadgeRequest; className?: string }>) {
  if (request.protocol === "http") {
    const method = request.method ?? "GET";
    return (
      <span
        className={cn(
          "w-11 shrink-0 font-mono text-[10.5px] font-semibold tracking-tight",
          METHOD_TEXT_CLASS[method],
          className,
        )}
      >
        {method === "DELETE" ? "DEL" : method}
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
