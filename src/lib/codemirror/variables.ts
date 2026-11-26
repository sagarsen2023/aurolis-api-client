import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

const variableMatcher = new MatchDecorator({
  regexp: /\{\{\s*[^{}\s]+\s*\}\}/g,
  decoration: Decoration.mark({ class: "cm-aurolis-variable" }),
});

export const variableHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = variableMatcher.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.decorations = variableMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function applyVariable(name: string) {
  return (
    view: EditorView,
    _completion: Completion,
    from: number,
    to: number,
  ) => {
    const closed = view.state.sliceDoc(to, to + 2) === "}}";
    const insert = closed ? name : `${name}}}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length + (closed ? 2 : 0) },
    });
  };
}

function variableSource(names: readonly string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\{\{[^{}\s]*/);
    if (!match) return null;
    return {
      from: match.from + 2,
      validFor: /^[^{}\s]*$/,
      options: names.map((name) => ({
        label: name,
        type: "variable",
        detail: "variable",
        apply: applyVariable(name),
      })),
    };
  };
}

export function variableCompletions(names: readonly string[]) {
  const data = [{ autocomplete: variableSource(names) }];
  return EditorState.languageData.of(() => data);
}
