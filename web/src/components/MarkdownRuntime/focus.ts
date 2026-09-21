import type { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";

export interface MarkdownCaretPoint {
  x: number;
  y: number;
}

/** Flip Crepe readonly and optionally put the caret at a screen point without scrolling the page. */
export function applyMarkdownEditable(crepe: Crepe, editable: boolean, point?: MarkdownCaretPoint | null): void {
  crepe.setReadonly(!editable);
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    let tr = view.state.tr.setMeta("memos-readonly", !editable);
    if (editable && point) {
      const found = view.posAtCoords({ left: point.x, top: point.y });
      if (found) {
        tr = tr.setSelection(TextSelection.near(view.state.doc.resolve(found.pos)));
      }
    }
    view.dispatch(tr);
    if (editable) {
      view.dom.focus({ preventScroll: true });
    }
  });
}
