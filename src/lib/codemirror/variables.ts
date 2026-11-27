import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  hoverTooltip,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { VariableInfo } from "@/types/workspace/variable.type";

const VARIABLE_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g;
const MAX_PREVIEW = 400;
const SECRET_MASK = "••••••••";

const resolvedMark = Decoration.mark({ class: "cm-aurolis-variable" });
const missingMark = Decoration.mark({
  class: "cm-aurolis-variable cm-aurolis-variable-missing",
});

type Lookup = ReadonlyMap<string, VariableInfo>;

function lookupOf(variables: readonly VariableInfo[]): Lookup {
  return new Map(variables.map((variable) => [variable.name, variable]));
}

function preview(variable: VariableInfo, limit = MAX_PREVIEW) {
  if (variable.secret) return SECRET_MASK;
  if (!variable.value) return "(empty)";
  return variable.value.length > limit
    ? `${variable.value.slice(0, limit)}…`
    : variable.value;
}

function decorate(view: EditorView, lookup: Lookup): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    for (const match of text.matchAll(VARIABLE_PATTERN)) {
      const start = from + (match.index ?? 0);
      builder.add(
        start,
        start + match[0].length,
        lookup.has(match[1]) ? resolvedMark : missingMark,
      );
    }
  }
  return builder.finish();
}

function highlight(lookup: Lookup) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = decorate(view, lookup);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = decorate(update.view, lookup);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function applyVariable(name: string) {
  return (
    view: EditorView,
    _completion: Completion,
    from: number,
    to: number,
  ) => {
    const after = view.state.sliceDoc(to, to + 2);
    const closed = after === "}}";
    const half = !closed && after.startsWith("}");
    const insert = closed ? name : half ? `${name}}` : `${name}}}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: {
        anchor: from + insert.length + (closed ? 2 : half ? 1 : 0),
      },
    });
  };
}

export function rankVariables(
  variables: readonly VariableInfo[],
  typed: string,
): VariableInfo[] {
  const query = typed.trim().toLowerCase();
  if (!query) return [...variables];
  const scored = variables
    .map((variable) => {
      const name = variable.name.toLowerCase();
      const index = name.indexOf(query);
      return { variable, index, starts: name.startsWith(query) };
    })
    .filter((entry) => entry.index !== -1);
  scored.sort(
    (a, b) =>
      Number(b.starts) - Number(a.starts) ||
      a.index - b.index ||
      a.variable.name.localeCompare(b.variable.name),
  );
  return scored.map((entry) => entry.variable);
}

function completionSource(variables: readonly VariableInfo[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\{\{\s*[^{}\s]*/);
    if (!match) return null;
    const typed = match.text.replace(/^\{\{\s*/, "");
    const options = rankVariables(variables, typed);
    if (options.length === 0) return null;
    return {
      from: match.to - typed.length,
      filter: false,
      options: options.map((variable, index) => ({
        label: variable.name,
        type: "variable",
        detail: preview(variable, 40),
        info: variable.source,
        boost: options.length - index,
        apply: applyVariable(variable.name),
      })),
    };
  };
}

function tooltipContent(name: string, variable: VariableInfo | undefined) {
  const dom = document.createElement("div");
  dom.className = "cm-aurolis-variable-tip";
  const title = document.createElement("div");
  title.className = "cm-aurolis-variable-tip-name";
  title.textContent = `{{${name}}}`;
  const value = document.createElement("div");
  value.className = variable
    ? "cm-aurolis-variable-tip-value"
    : "cm-aurolis-variable-tip-value cm-aurolis-variable-tip-missing";
  value.textContent = variable ? preview(variable) : "Not defined";
  const source = document.createElement("div");
  source.className = "cm-aurolis-variable-tip-source";
  source.textContent = variable
    ? `${variable.source}${variable.secret ? " · secret" : ""}`
    : "Add it to the environment, the collection or globals.";
  dom.append(title, value, source);
  return dom;
}

function hover(lookup: Lookup) {
  return hoverTooltip(
    (view, pos) => {
      const line = view.state.doc.lineAt(pos);
      for (const match of line.text.matchAll(VARIABLE_PATTERN)) {
        const from = line.from + (match.index ?? 0);
        const to = from + match[0].length;
        if (pos < from || pos > to) continue;
        const name = match[1];
        return {
          pos: from,
          end: to,
          above: true,
          create: () => ({ dom: tooltipContent(name, lookup.get(name)) }),
        };
      }
      return null;
    },
    { hoverTime: 250 },
  );
}

export function variableSupport(variables: readonly VariableInfo[]) {
  const lookup = lookupOf(variables);
  const data = [{ autocomplete: completionSource(variables) }];
  return [
    highlight(lookup),
    hover(lookup),
    EditorState.languageData.of(() => data),
  ];
}
