import { Prec } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { findJsonComments } from "@/lib/jsonc";

const commentMark = Decoration.mark({ class: "cm-aurolis-comment" });

function commentDecorations(view: EditorView): DecorationSet {
  return Decoration.set(
    findJsonComments(view.state.doc.toString()).map(({ from, to }) =>
      commentMark.range(from, to),
    ),
  );
}

export const jsonCommentHighlight = Prec.lowest(
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = commentDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = commentDecorations(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
);
