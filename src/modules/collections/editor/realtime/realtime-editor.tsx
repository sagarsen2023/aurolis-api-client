import { useState } from "react";
import { BookmarkPlus, SendHorizontal, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtimeSession } from "@/hooks/use-realtime";
import { useUnresolvedVariables } from "@/hooks/use-unresolved-variables";
import { useTypescriptSheet } from "@/hooks/use-typescript-sheet";
import { useVariableNames } from "@/hooks/use-variable-names";
import { payloadSource } from "@/lib/typescript-sources";
import { handleError } from "@/hooks/usePromise";
import { cn } from "@/lib/utils";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";
import type {
  MessageFormat,
  SavedMessage,
} from "@/types/workspace/request.type";
import { toTypeName } from "@/utils/generate-typescript-interface";
import { isModEnter } from "@/utils/platform";
import AuthEditor from "../../shared/auth-editor";
import CodeEditor from "../../shared/code-editor";
import KeyValueEditor from "../../shared/key-value-editor";
import OptionSelect from "../../shared/option-select";
import DocsEditor from "../docs-editor";
import EditorSectionTabs, { type EditorSection } from "../editor-section-tabs";
import SplitLayout from "../split-layout";
import UnresolvedNotice from "../unresolved-notice";
import UrlBar from "../url-bar";
import MessageLog from "./message-log";
import { countEnabled } from "@/utils/count-enabled";

type RealtimeDraft = Extract<
  SavedRequest,
  { protocol: "websocket" | "socketio" }
>;

type Composer = { event: string; body: string; format: MessageFormat };

const FORMAT_OPTIONS: ReadonlyArray<{ value: MessageFormat; label: string }> = [
  { value: "json", label: "JSON" },
  { value: "text", label: "Text" },
];

const STATUS_DOT: Record<string, string> = {
  connected: "bg-success",
  connecting: "bg-warning animate-pulse",
  disconnected: "bg-dim",
};

function messageName(composer: Composer) {
  if (composer.event.trim()) return composer.event.trim();
  const firstLine = composer.body.trim().split("\n")[0] ?? "";
  return firstLine.slice(0, 40) || "Message";
}

function ComposerPanel({
  request,
  composer,
  setComposer,
  connected,
  onSend,
  onSave,
  variables,
  onShowTypescript,
}: Readonly<{
  request: RealtimeDraft;
  variables: readonly string[];
  onShowTypescript: () => void;
  composer: Composer;
  setComposer: (composer: Composer) => void;
  connected: boolean;
  onSend: () => void;
  onSave: () => void;
}>) {
  const isSocketio = request.protocol === "socketio";
  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        if (!isModEnter(event)) return;
        event.preventDefault();
        if (connected) onSend();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        {isSocketio ? (
          <Input
            id="realtime-event"
            label="Event"
            className="h-9 w-56 font-mono text-[13px]"
            placeholder="message"
            value={composer.event}
            onChange={(event) =>
              setComposer({ ...composer, event: event.target.value })
            }
          />
        ) : null}
        <OptionSelect
          label="Format"
          className="w-28"
          value={composer.format}
          options={FORMAT_OPTIONS}
          onChange={(format) => setComposer({ ...composer, format })}
        />
      </div>
      <CodeEditor
        label="Message"
        language={composer.format === "json" ? "json" : "text"}
        minRows={5}
        variables={variables}
        onShowTypescript={
          composer.format === "json" ? onShowTypescript : undefined
        }
        value={composer.body}
        placeholder={
          composer.format === "json" ? '{\n  "type": "ping"\n}' : "Hello"
        }
        onChange={(body) => setComposer({ ...composer, body })}
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onSave}>
          <BookmarkPlus />
          Save message
        </Button>
        <Button size="sm" disabled={!connected} onClick={onSend}>
          <SendHorizontal />
          Send
        </Button>
      </div>
    </div>
  );
}

function SavedMessages({
  messages,
  onLoad,
  onDelete,
}: Readonly<{
  messages: SavedMessage[];
  onLoad: (message: SavedMessage) => void;
  onDelete: (id: string) => void;
}>) {
  if (messages.length === 0) {
    return (
      <p className="text-[13px] text-mute">
        No saved messages. Compose one and choose “Save message” to keep it with
        this request.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line/60">
      {messages.map((message) => (
        <li key={message.id} className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-foreground">
              {message.name}
            </p>
            <p className="truncate font-mono text-[12px] text-mute">
              {message.event ? `${message.event} · ` : ""}
              {message.body.replace(/\s+/g, " ").slice(0, 120) || "Empty"}
            </p>
          </div>
          <Button size="xs" variant="outline" onClick={() => onLoad(message)}>
            <Upload />
            Use
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Delete ${message.name}`}
            onClick={() => onDelete(message.id)}
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SocketioSettings({
  request,
  onChange,
}: Readonly<{
  request: Extract<RealtimeDraft, { protocol: "socketio" }>;
  onChange: (request: RealtimeDraft) => void;
}>) {
  const [events, setEvents] = useState(request.socketio.events.join(", "));
  const commitEvents = () =>
    onChange({
      ...request,
      socketio: {
        ...request.socketio,
        events: events
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      },
    });
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Input
        id="socketio-path"
        label="Path"
        className="h-9 font-mono text-[13px]"
        value={request.socketio.path}
        placeholder="/socket.io"
        onChange={(event) =>
          onChange({
            ...request,
            socketio: { ...request.socketio, path: event.target.value },
          })
        }
      />
      <div className="flex flex-col gap-1.5">
        <Input
          id="socketio-events"
          label="Listen to events"
          className="h-9 font-mono text-[13px]"
          value={events}
          placeholder="All events"
          onChange={(event) => setEvents(event.target.value)}
          onBlur={commitEvents}
        />
        <p className="text-[12.5px] text-mute">
          Comma-separated. Leave empty to log every event. Changes apply on the
          next connect.
        </p>
      </div>
    </div>
  );
}

function RealtimeEditor({
  request,
  onChange,
}: Readonly<{
  request: RealtimeDraft;
  onChange: (request: RealtimeDraft) => void;
}>) {
  const { session, connect, disconnect, send, clear } = useRealtimeSession(
    request.id,
  );
  const unresolved = useUnresolvedVariables(request);
  const variableNames = useVariableNames(request.id);
  const showTypescript = useTypescriptSheet(request.name);
  const [composer, setComposer] = useState<Composer>({
    event: "",
    body: "",
    format: "json",
  });
  const connected = session.status === "connected";
  const busy = session.status === "connecting";

  const toggleConnection = () => {
    if (connected) disconnect().catch(handleError);
    else if (!busy) void connect(request);
  };

  const sendMessage = () => {
    send(request, composer).catch(handleError);
  };

  const saveMessage = () => {
    const message: SavedMessage = {
      id: crypto.randomUUID(),
      name: messageName(composer),
      ...composer,
    };
    onChange({ ...request, messages: [...request.messages, message] });
    toast.success("Message saved to the request. Save the request to keep it.");
  };

  const sections: EditorSection[] = [
    {
      value: "message",
      label: "Message",
      content: (
        <ComposerPanel
          request={request}
          composer={composer}
          setComposer={setComposer}
          connected={connected}
          onSend={sendMessage}
          onSave={saveMessage}
          variables={variableNames}
          onShowTypescript={() =>
            showTypescript(
              [
                payloadSource(
                  composer.body,
                  toTypeName(composer.event || request.name, "Message"),
                  "Message",
                ),
              ],
              "payload",
            )
          }
        />
      ),
    },
    {
      value: "saved",
      label: "Saved",
      count: request.messages.length,
      content: (
        <SavedMessages
          messages={request.messages}
          onLoad={(message) =>
            setComposer({
              event: message.event,
              body: message.body,
              format: message.format,
            })
          }
          onDelete={(id) =>
            onChange({
              ...request,
              messages: request.messages.filter((message) => message.id !== id),
            })
          }
        />
      ),
    },
    {
      value: "params",
      label: "Params",
      count: countEnabled(request.params),
      content: (
        <KeyValueEditor
          label="Query parameters"
          rows={request.params}
          keyPlaceholder="Parameter"
          onChange={(params) => onChange({ ...request, params })}
        />
      ),
    },
    {
      value: "headers",
      label: "Headers",
      count: countEnabled(request.headers),
      content: (
        <KeyValueEditor
          label="Handshake headers"
          rows={request.headers}
          keyPlaceholder="Header"
          onChange={(headers) => onChange({ ...request, headers })}
        />
      ),
    },
    {
      value: "auth",
      label: "Auth",
      content: (
        <AuthEditor
          auth={request.auth}
          onChange={(auth) => onChange({ ...request, auth })}
        />
      ),
    },
    ...(request.protocol === "socketio"
      ? [
          {
            value: "settings",
            label: "Settings",
            content: <SocketioSettings request={request} onChange={onChange} />,
          },
        ]
      : []),
    {
      value: "docs",
      label: "Docs",
      content: (
        <DocsEditor
          subject="connection"
          value={request.description}
          onChange={(description) => onChange({ ...request, description })}
        />
      ),
    },
  ];

  const top = (
    <>
      <UrlBar
        url={request.url}
        placeholder={
          request.protocol === "socketio"
            ? "https://realtime.example.com"
            : "wss://echo.example.com/socket"
        }
        onUrlChange={(url) => onChange({ ...request, url })}
        onSubmit={toggleConnection}
        leading={
          <span className="flex items-center gap-2 pl-4 text-[12px] text-mute">
            <span
              className={cn("size-2 rounded-full", STATUS_DOT[session.status])}
              aria-hidden
            />
            <span className="capitalize">{session.status}</span>
          </span>
        }
        action={
          <Button
            type="submit"
            disabled={busy}
            className="h-10 min-w-28 px-5"
            variant={connected ? "outline" : "default"}
          >
            {connected ? "Disconnect" : "Connect"}
          </Button>
        }
      />
      {unresolved.length > 0 ? (
        <div className="px-5 pb-2">
          <UnresolvedNotice names={unresolved} />
        </div>
      ) : null}
      <EditorSectionTabs
        label="Connection sections"
        defaultValue="message"
        sections={sections}
      />
    </>
  );

  return (
    <SplitLayout
      top={top}
      bottom={<MessageLog events={session.events} onClear={clear} />}
    />
  );
}

export default RealtimeEditor;
