import { Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { headingAnchor } from "@/utils/markdown-manipulation";

/** Stamp outline fragments onto h1–h4 so MemoOutline can scroll to them. */
export function createHeadingIdPlugin() {
  return $prose(
    () =>
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const used = new Map<string, number>();
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "heading") {
                return;
              }
              const level = Number(node.attrs.level);
              if (level < 1 || level > 4) {
                return;
              }
              const text = node.textContent;
              if (!text) {
                return;
              }
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { id: headingAnchor(text, used) }));
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
  );
}
