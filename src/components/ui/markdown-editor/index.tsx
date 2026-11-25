import { useState } from "react";
import MDEditor, { commands, type ICommand } from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  SquareCode,
  Strikethrough,
} from "lucide-react";
import { cn } from "cn";
import { useColorMode } from "@/hooks/use-color-mode";
import { Label } from "../label";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import "./markdown-editor.css";

type Mode = "edit" | "preview";

interface MarkdownEditorProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  emptyPreview?: string;
  error?: string;
  minHeight?: number;
  defaultMode?: Mode;
  className?: string;
}

const withIcon = (command: ICommand, Icon: typeof Bold, label: string) => ({
  ...command,
  icon: <Icon className="size-4" strokeWidth={2.25} />,
  buttonProps: { "aria-label": label, title: label },
});

const TOOLBAR: ICommand[] = [
  withIcon(commands.title2, Heading2, "Heading"),
  withIcon(commands.bold, Bold, "Bold (Ctrl+B)"),
  withIcon(commands.italic, Italic, "Italic (Ctrl+I)"),
  withIcon(commands.strikethrough, Strikethrough, "Strikethrough"),
  commands.divider,
  withIcon(commands.link, Link, "Link (Ctrl+L)"),
  withIcon(commands.quote, Quote, "Quote"),
  withIcon(commands.code, Code, "Inline code"),
  withIcon(commands.codeBlock, SquareCode, "Code block"),
  commands.divider,
  withIcon(commands.unorderedListCommand, List, "Bulleted list"),
  withIcon(commands.orderedListCommand, ListOrdered, "Numbered list"),
  withIcon(commands.checkedListCommand, ListChecks, "Checklist"),
  withIcon(commands.hr, Minus, "Divider"),
];

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: "edit", label: "Write" },
  { value: "preview", label: "Preview" },
];

function ModeSwitch({
  mode,
  onChange,
}: Readonly<{ mode: Mode; onChange: (mode: Mode) => void }>) {
  return (
    <div
      role="tablist"
      aria-label="Editor mode"
      className="inline-flex h-8 items-center rounded-4xl bg-muted p-0.5 text-muted-foreground"
    >
      {MODES.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={mode === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "inline-flex h-7 items-center rounded-4xl px-3 text-xs font-medium transition-all",
            mode === item.value
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function initialMode(value: string | undefined, defaultMode?: Mode): Mode {
  if (defaultMode) return defaultMode;
  return value?.trim() ? "preview" : "edit";
}

function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder = "Write in markdown…",
  emptyPreview = "Nothing to preview yet.",
  error,
  minHeight = 220,
  defaultMode,
  className,
}: Readonly<MarkdownEditorProps>) {
  const [mode, setMode] = useState<Mode>(() => initialMode(value, defaultMode));
  const colorMode = useColorMode();
  const isEmpty = !value?.trim();

  const modeSwitch: ICommand = {
    name: "mode-switch",
    keyCommand: "mode-switch",
    render: () => (
      <ModeSwitch key="mode-switch" mode={mode} onChange={setMode} />
    ),
  };

  return (
    <div className={cn("w-full", className)}>
      {label ? <Label className="mb-2">{label}</Label> : null}
      <div
        className="aurolis-md-editor aurolis-markdown"
        data-color-mode={colorMode}
      >
        <div
          className={cn(
            "overflow-hidden rounded-2xl border bg-input/30 transition-[color,box-shadow]",
            "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
            error
              ? "border-destructive focus-within:ring-destructive/20"
              : "border-input",
          )}
        >
          <MDEditor
            value={mode === "preview" && isEmpty ? `_${emptyPreview}_` : value}
            onChange={(next) => onChange(next ?? "")}
            height={minHeight}
            minHeight={120}
            preview={mode}
            textareaProps={{ placeholder }}
            previewOptions={{ rehypePlugins: [[rehypeSanitize]] }}
            commands={mode === "edit" ? TOOLBAR : []}
            extraCommands={[modeSwitch]}
          />
        </div>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

export default MarkdownEditor;
export { default as MarkdownViewer } from "./markdown-viewer";
