import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HttpResponseData } from "@/types/engine/http-engine.type";
import { formatBytes } from "@/utils/format-bytes";
import { isJsonContentType, prettyJson } from "@/utils/json";
import JsonView from "../shared/json-view";

type View = "pretty" | "raw";

function ResponseBody({ response }: Readonly<{ response: HttpResponseData }>) {
  const [view, setView] = useState<View>("pretty");
  const pretty = useMemo(() => {
    if (response.bodyEncoding !== "text") return null;
    const looksJson =
      isJsonContentType(response.contentType) || /^\s*[{[]/.test(response.body);
    return looksJson ? prettyJson(response.body) : null;
  }, [response]);

  if (response.bodyEncoding === "base64") {
    return (
      <img
        alt="Response"
        src={`data:${response.contentType ?? "image/png"};base64,${response.body}`}
        className="max-h-96 max-w-full rounded-lg border border-line object-contain"
      />
    );
  }
  if (response.bodyEncoding === "omitted") {
    return (
      <p className="text-[13px] text-mute">
        Binary response ({response.contentType ?? "unknown type"},{" "}
        {formatBytes(response.size)}). Aurolis shows text, JSON and image
        responses.
      </p>
    );
  }
  if (!response.body) {
    return <p className="text-[13px] text-mute">The response has no body.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {pretty ? (
        <div className="flex gap-1" role="group" aria-label="Body view">
          {(["pretty", "raw"] as const).map((option) => (
            <Button
              key={option}
              size="xs"
              variant={view === option ? "secondary" : "ghost"}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {option === "pretty" ? "Pretty" : "Raw"}
            </Button>
          ))}
        </div>
      ) : null}
      {pretty && view === "pretty" ? (
        <JsonView text={pretty} />
      ) : (
        <pre className="font-mono text-[12.5px] leading-relaxed break-all whitespace-pre-wrap text-code">
          {response.body}
        </pre>
      )}
      {response.truncated ? (
        <p className="text-[12px] text-warning">
          Showing the first 20 MB of {formatBytes(response.size)}.
        </p>
      ) : null}
    </div>
  );
}

export default ResponseBody;
