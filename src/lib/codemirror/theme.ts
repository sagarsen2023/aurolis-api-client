import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const MONO_FONT =
  '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace';

const SELECTION = "color-mix(in oklab, var(--vio) 26%, transparent)";

const editorTheme = EditorView.theme({
  "&": {
    color: "var(--code-ink)",
    backgroundColor: "transparent",
    fontSize: "12.5px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: MONO_FONT, lineHeight: "1.65" },
  ".cm-content": { caretColor: "var(--vio)", padding: "10px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--vio)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: SELECTION },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--dim)",
    border: "none",
    borderRight: "1px solid var(--line)",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 12px" },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklab, var(--hover) 80%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--ink)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--raise)",
    border: "1px solid var(--line2)",
    color: "var(--mute)",
    borderRadius: "6px",
    padding: "0 6px",
  },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "color-mix(in oklab, var(--vio) 20%, transparent)",
    outline: "1px solid color-mix(in oklab, var(--vio) 45%, transparent)",
  },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in oklab, var(--amber) 28%, transparent)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in oklab, var(--amber) 50%, transparent)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "color-mix(in oklab, var(--vio) 14%, transparent)",
  },
  ".cm-placeholder": { color: "var(--dim)" },
  ".cm-tooltip": {
    backgroundColor: "var(--menu-bg)",
    color: "var(--ink)",
    border: "1px solid var(--line2)",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.18)",
  },
  ".cm-tooltip-autocomplete > ul": { fontFamily: MONO_FONT, fontSize: "12px" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "3px 10px" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--sel)",
    color: "var(--ink)",
  },
  ".cm-completionDetail": { color: "var(--dim)", marginLeft: "8px" },
  ".cm-completionInfo": { padding: "6px 10px", maxWidth: "320px" },
  ".cm-panels": {
    backgroundColor: "var(--panel)",
    color: "var(--ink)",
  },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--line)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--line)" },
  ".cm-panel input, .cm-panel button": { fontFamily: "inherit" },
  ".cm-panel.cm-search input": {
    border: "1px solid var(--line2)",
    borderRadius: "8px",
    backgroundColor: "transparent",
    color: "var(--ink)",
    padding: "2px 6px",
  },
  ".cm-button": {
    backgroundImage: "none",
    backgroundColor: "var(--raise)",
    border: "1px solid var(--line2)",
    borderRadius: "8px",
    color: "var(--ink)",
  },
  ".cm-diagnostic": { fontFamily: MONO_FONT, fontSize: "12px" },
  ".cm-aurolis-comment, .cm-aurolis-comment *": {
    color: "var(--dim)",
    fontStyle: "italic",
  },
  ".cm-aurolis-variable": {
    color: "var(--vio)",
    backgroundColor: "color-mix(in oklab, var(--vio) 14%, transparent)",
    borderRadius: "4px",
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: t.propertyName, color: "var(--j-k)" },
  { tag: [t.string, t.special(t.string)], color: "var(--j-s)" },
  { tag: [t.number, t.integer, t.float], color: "var(--j-n)" },
  { tag: t.bool, color: "var(--j-b)" },
  { tag: t.null, color: "var(--j-z)" },
  {
    tag: [t.keyword, t.operatorKeyword, t.definitionKeyword, t.modifier],
    color: "var(--vio)",
    fontWeight: "600",
  },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--j-b)" },
  {
    tag: [t.variableName, t.special(t.variableName)],
    color: "var(--j-n)",
  },
  {
    tag: [t.definition(t.variableName), t.function(t.variableName)],
    color: "var(--j-k)",
  },
  { tag: [t.attributeName, t.labelName], color: "var(--j-k)" },
  { tag: t.attributeValue, color: "var(--j-s)" },
  { tag: [t.tagName, t.angleBracket], color: "var(--vio)" },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: "var(--dim)",
    fontStyle: "italic",
  },
  { tag: [t.punctuation, t.bracket, t.separator], color: "var(--mute)" },
  { tag: t.invalid, color: "var(--red)" },
]);

export const aurolisTheme = [editorTheme, syntaxHighlighting(highlightStyle)];
