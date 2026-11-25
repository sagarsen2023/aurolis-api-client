import { javascript } from "@codemirror/lang-javascript";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { EditorState, type Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { graphql } from "cm6-graphql";
import type { GraphQLSchema } from "graphql";

export type CodeLanguage = "json" | "xml" | "graphql" | "typescript" | "text";

const VARIABLE_PATTERN = /\{\{[^{}]*\}\}/g;
const parseJson = jsonParseLinter();

function maskVariables(text: string) {
  return text.replace(VARIABLE_PATTERN, (match) =>
    "0".padEnd(match.length, " "),
  );
}

function lintJsonWithVariables(view: EditorView): Diagnostic[] {
  const text = view.state.doc.toString();
  if (!text.trim()) return [];
  const masked = EditorState.create({ doc: maskVariables(text) });
  return parseJson({ state: masked } as EditorView);
}

const jsonLinter = linter(lintJsonWithVariables, { delay: 400 });

export function languageExtension(
  language: CodeLanguage,
  options: { readOnly?: boolean; graphqlSchema?: GraphQLSchema | null } = {},
): Extension {
  switch (language) {
    case "json":
      return options.readOnly ? json() : [json(), jsonLinter, lintGutter()];
    case "xml":
      return xml();
    case "typescript":
      return javascript({ typescript: true });
    case "graphql":
      return [graphql(options.graphqlSchema ?? undefined), lintGutter()];
    default:
      return [];
  }
}
