import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { Prec, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder as placeholderText,
} from "@codemirror/view";
import type { GraphQLSchema } from "graphql";
import { cn } from "@/lib/utils";
import {
  languageExtension,
  type CodeLanguage,
} from "@/lib/codemirror/languages";
import { aurolisTheme } from "@/lib/codemirror/theme";
import { variableSupport } from "@/lib/codemirror/variables";
import { useVariableScopeContext } from "@/context/variable-scope-context";
import type { VariableInfo } from "@/types/workspace/variable.type";

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  label: string;
  language?: CodeLanguage;
  placeholder?: string;
  readOnly?: boolean;
  variables?: readonly VariableInfo[];
  graphqlSchema?: GraphQLSchema | null;
  minHeight?: string;
  height?: string;
  invalid?: boolean;
  className?: string;
}

const EMPTY: readonly VariableInfo[] = [];

const SHARED_SETUP = {
  lineNumbers: true,
  foldGutter: true,
  bracketMatching: true,
  searchKeymap: true,
  tabSize: 2,
};

const EDITABLE_SETUP = {
  ...SHARED_SETUP,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  closeBrackets: true,
  autocompletion: true,
};

const READ_ONLY_SETUP = {
  ...SHARED_SETUP,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  closeBrackets: false,
  autocompletion: false,
};

const keepModEnterForSend: Extension = Prec.highest(
  keymap.of([{ key: "Mod-Enter", run: () => true }]),
);

function CodeEditor({
  value,
  onChange,
  label,
  language = "text",
  placeholder,
  readOnly = false,
  variables: variablesProp,
  graphqlSchema = null,
  minHeight = "140px",
  height,
  invalid = false,
  className,
}: Readonly<CodeEditorProps>) {
  const scope = useVariableScopeContext();
  const variables = variablesProp ?? scope ?? EMPTY;
  const latestOnChange = useRef(onChange);
  useLayoutEffect(() => {
    latestOnChange.current = onChange;
  });
  const handleChange = useCallback(
    (next: string) => latestOnChange.current?.(next),
    [],
  );
  const extensions = useMemo(
    () => [
      languageExtension(language, { readOnly, graphqlSchema }),
      readOnly ? [] : variableSupport(variables),
      keepModEnterForSend,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": label }),
      placeholder ? placeholderText(placeholder) : [],
    ],
    [language, readOnly, graphqlSchema, variables, label, placeholder],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-input/20 transition-[color,box-shadow]",
        readOnly
          ? "border-line"
          : "border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        invalid && "border-destructive focus-within:ring-destructive/20",
        className,
      )}
    >
      <CodeMirror
        value={value}
        onChange={readOnly ? undefined : handleChange}
        readOnly={readOnly}
        theme={aurolisTheme}
        height={height}
        minHeight={minHeight}
        className={cn(height === "100%" && "h-full")}
        extensions={extensions}
        basicSetup={readOnly ? READ_ONLY_SETUP : EDITABLE_SETUP}
      />
    </div>
  );
}

export default CodeEditor;
