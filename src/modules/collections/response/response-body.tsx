import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HttpResponseData } from "@/types/engine/http-engine.type";
import { formatBytes } from "@/utils/format-bytes";
import { CodeField } from "@/components/code-field";
import type { CodeLanguage } from "@/lib/codemirror/languages";
import { isJsonContentType, prettyJson } from "@/utils/json";

type View = "pretty" | "raw";

const VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: "pretty", label: "Pretty" },
  { value: "raw", label: "Raw" },
];

function rawLanguage(contentType: string | null): CodeLanguage {
  if (isJsonContentType(contentType)) return "json";
  if (contentType && /[/+]xml\b/i.test(contentType)) return "xml";
  return "text";
}

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

  const showPretty = pretty !== null && view === "pretty";
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {pretty ? (
        <div className="flex gap-1" role="group" aria-label="Body view">
          {VIEWS.map((option) => (
            <Button
              key={option.value}
              size="xs"
              variant={view === option.value ? "secondary" : "ghost"}
              aria-pressed={view === option.value}
              onClick={() => setView(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <CodeField
            readOnly
            label="Response body"
            value={showPretty ? pretty : response.body}
            language={showPretty ? "json" : rawLanguage(response.contentType)}
            height="100%"
            className="h-full"
          />
        </div>
      </div>
      {response.truncated ? (
        <p className="text-[12px] text-warning">
          Showing the first 20 MB of {formatBytes(response.size)}.
        </p>
      ) : null}
    </div>
  );
}

export default ResponseBody;
