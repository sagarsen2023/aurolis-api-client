import {
  type ClipboardEvent,
  type KeyboardEvent,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { autocompletion } from "@codemirror/autocomplete";
import { history, historyKeymap, standardKeymap } from "@codemirror/commands";
import { EditorState, Prec } from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder as placeholderText,
} from "@codemirror/view";
import { aurolisTheme, singleLineTheme } from "@/lib/codemirror/theme";
import { variableSupport } from "@/lib/codemirror/variables";
import type { VariableInfo } from "@/types/workspace/variable.type";

export interface VariableLineEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: readonly VariableInfo[];
  ariaLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
  onPasteText?: (text: string) => boolean;
}

const singleLine = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.docChanged || transaction.newDoc.lines === 1) {
    return transaction;
  }
  const flattened = transaction.newDoc.toString().replace(/\r?\n/g, " ");
  return [
    transaction,
    {
      changes: { from: 0, to: transaction.newDoc.length, insert: flattened },
      sequential: true,
    },
  ];
});

const BASIC_SETUP = false as const;

function VariableLineEditor({
  value,
  onChange,
  variables,
  ariaLabel,
  placeholder,
  autoFocus,
  onSubmit,
  onPasteText,
}: Readonly<VariableLineEditorProps>) {
  const latestOnChange = useRef(onChange);
  useLayoutEffect(() => {
    latestOnChange.current = onChange;
  });
  const handleChange = useCallback(
    (next: string) => latestOnChange.current(next),
    [],
  );

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey) return;
    if (event.metaKey || event.ctrlKey) return;
    if (event.currentTarget.querySelector(".cm-tooltip-autocomplete")) return;
    event.preventDefault();
    event.stopPropagation();
    onSubmit?.();
  };

  const onPasteCapture = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (text && onPasteText?.(text)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const extensions = useMemo(
    () => [
      singleLineTheme,
      singleLine,
      history(),
      Prec.high(
        keymap.of([
          { key: "Enter", run: () => true },
          { key: "Mod-Enter", run: () => true },
        ]),
      ),
      keymap.of([...standardKeymap, ...historyKeymap]),
      autocompletion({ icons: false }),
      variableSupport(variables),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        role: "textbox",
        "aria-multiline": "false",
        spellcheck: "false",
      }),
      placeholder ? placeholderText(placeholder) : [],
    ],
    [ariaLabel, placeholder, variables],
  );

  return (
    <div
      className="min-w-0 flex-1"
      onKeyDownCapture={onKeyDownCapture}
      onPasteCapture={onPasteCapture}
    >
      <CodeMirror
        value={value}
        onChange={handleChange}
        theme={aurolisTheme}
        autoFocus={autoFocus}
        basicSetup={BASIC_SETUP}
        extensions={extensions}
      />
    </div>
  );
}

export default VariableLineEditor;
