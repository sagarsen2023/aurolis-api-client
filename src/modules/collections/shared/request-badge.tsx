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

function badgeOf(request: BadgeRequest) {
  if (request.protocol === "http") {
    const method = request.method ?? "GET";
    return {
      text: method === "DELETE" ? "DEL" : method,
      color: METHOD_TEXT_CLASS[method],
    };
  }
  const option = PROTOCOL_OPTIONS.find(
    (entry) => entry.value === request.protocol,
  );
  return { text: option?.badge ?? "", color: option?.badgeClass };
}

function RequestBadge({
  request,
  className,
}: Readonly<{ request: BadgeRequest; className?: string }>) {
  const { text, color } = badgeOf(request);
  return (
    <span className={cn("w-11 shrink-0 text-right", className)}>
      <span
        className={cn(
          "font-mono text-[10.5px] leading-none font-semibold tracking-tight",
          color,
        )}
      >
        {text}
      </span>
    </span>
  );
}

export default RequestBadge;
