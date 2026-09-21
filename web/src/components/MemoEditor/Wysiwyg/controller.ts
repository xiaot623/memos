import type { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { AllSelection, TextSelection } from "@milkdown/kit/prose/state";
import { insert, replaceAll } from "@milkdown/kit/utils";
import type { EditorController, FormattingController } from "../types/editorController";

export function createWysiwygController(getCrepe: () => Crepe | undefined, formatting: FormattingController): EditorController {
  const withView = (run: (ctx: Ctx) => void) => {
    const crepe = getCrepe();
    if (!crepe) {
      return;
    }
    crepe.editor.action(run);
  };

  return {
    focus: () => {
      withView((ctx) => {
        ctx.get(editorViewCtx).dom.focus({ preventScroll: true });
      });
    },
    hasFocus: () => {
      const crepe = getCrepe();
      if (!crepe) {
        return false;
      }
      let focused = false;
      crepe.editor.action((ctx) => {
        focused = ctx.get(editorViewCtx).hasFocus();
      });
      return focused;
    },
    isEmpty: () => {
      const crepe = getCrepe();
      if (!crepe) {
        return true;
      }
      return crepe.getMarkdown().trim() === "";
    },
    getMarkdown: () => getCrepe()?.getMarkdown() ?? "",
    setMarkdown: (markdown) => {
      withView((ctx) => {
        replaceAll(markdown)(ctx);
      });
    },
    insertMarkdown: (markdown) => {
      if (!markdown) {
        return;
      }
      withView((ctx) => {
        insert(markdown)(ctx);
        ctx.get(editorViewCtx).dom.focus({ preventScroll: true });
      });
    },
    createUploadAnchor: (_descriptor, _position) => {
      // Milkdown has no CodeMirror widget anchors; resolveUploadAnchor inserts markdown.
    },
    updateUploadAnchor: () => undefined,
    resolveUploadAnchor: (_id, markdown) => {
      if (!markdown) {
        return;
      }
      withView((ctx) => {
        insert(markdown)(ctx);
        ctx.get(editorViewCtx).dom.focus({ preventScroll: true });
      });
    },
    cancelUploadAnchor: () => undefined,
    getCursor: () => {
      const crepe = getCrepe();
      if (!crepe) {
        return 0;
      }
      let position = 0;
      crepe.editor.action((ctx) => {
        position = ctx.get(editorViewCtx).state.selection.from;
      });
      return position;
    },
    setCursor: (position) => {
      withView((ctx) => {
        const view = ctx.get(editorViewCtx);
        const bounded = Math.min(Math.max(position, 0), view.state.doc.content.size);
        view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(bounded))).scrollIntoView());
      });
    },
    scrollToCursor: () => {
      withView((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.scrollIntoView());
      });
    },
    selectAll: () => {
      withView((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
      });
    },
    formatting,
  };
}
