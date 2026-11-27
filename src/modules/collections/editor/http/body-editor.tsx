import type { ReactNode } from "react";
import { BODY_MODE_OPTIONS } from "@/constants/request";
import type {
  KeyValue,
  RequestBody,
  RequestBodyMode,
} from "@/types/workspace/request.type";
import CodeEditor from "../../shared/code-editor";
import KeyValueEditor from "../../shared/key-value-editor";
import OptionSelect from "../../shared/option-select";

function rawOf(body: RequestBody) {
  return "raw" in body ? body.raw : "";
}

function fieldsOf(body: RequestBody): KeyValue[] {
  return "fields" in body ? body.fields : [];
}

function switchMode(body: RequestBody, mode: RequestBodyMode): RequestBody {
  switch (mode) {
    case "json":
    case "text":
    case "xml":
      return { mode, raw: rawOf(body) };
    case "urlencoded":
    case "form-data":
      return { mode, fields: fieldsOf(body) };
    default:
      return { mode: "none" };
  }
}

const PLACEHOLDERS: Record<string, string> = {
  json: '{\n  "amount": 1200,\n  "currency": "{{currency}}"\n}',
  xml: "<payment>\n  <amount>1200</amount>\n</payment>",
  text: "Plain text body",
};

function BodyContent({
  body,
  onChange,
  onShowTypescript,
  modeSelect,
}: Readonly<{
  body: RequestBody;
  onChange: (body: RequestBody) => void;
  onShowTypescript: () => void;
  modeSelect: ReactNode;
}>) {
  switch (body.mode) {
    case "json":
    case "text":
    case "xml":
      return (
        <CodeEditor
          label="Request body"
          language={body.mode === "text" ? "text" : body.mode}
          onShowTypescript={onShowTypescript}
          toolbarStart={modeSelect}
          value={body.raw}
          placeholder={PLACEHOLDERS[body.mode]}
          onChange={(raw) => onChange({ ...body, raw })}
        />
      );
    case "urlencoded":
    case "form-data":
      return (
        <div className="flex flex-col gap-3">
          <div className="flex">{modeSelect}</div>
          <KeyValueEditor
            label="Body fields"
            rows={body.fields}
            keyPlaceholder="Field"
            onChange={(fields) => onChange({ ...body, fields })}
          />
        </div>
      );
    default:
      return (
        <div className="flex flex-col gap-3">
          <div className="flex">{modeSelect}</div>
          <p className="text-[13px] text-mute">This request sends no body.</p>
        </div>
      );
  }
}

function BodyEditor({
  body,
  method,
  onChange,
  onShowTypescript,
}: Readonly<{
  body: RequestBody;
  method: string;
  onChange: (body: RequestBody) => void;
  onShowTypescript: () => void;
}>) {
  const ignored =
    (method === "GET" || method === "HEAD") && body.mode !== "none";
  return (
    <div className="flex flex-col gap-3">
      {ignored ? (
        <p className="text-[12.5px] text-warning">
          {method} requests can't carry a body, so this body isn't sent.
        </p>
      ) : null}
      <BodyContent
        body={body}
        onChange={onChange}
        onShowTypescript={onShowTypescript}
        modeSelect={
          <OptionSelect
            ariaLabel="Body type"
            className="w-44"
            value={body.mode}
            options={BODY_MODE_OPTIONS}
            onChange={(mode) => onChange(switchMode(body, mode))}
          />
        }
      />
    </div>
  );
}

export default BodyEditor;
