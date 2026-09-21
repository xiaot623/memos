import { Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { RESERVED_MEMO_COMMENTS_ANCHOR_IDS } from "@/lib/memo-comments";
import { createUniqueSlugGenerator, slugify } from "@/utils/markdown-manipulation";

const FALLBACK_HEADING_SLUG = "heading";

/** Stamp outline fragments onto headings using the same slugs as `rehypeHeadingId`. */
export function createHeadingIdPlugin() {
  return $prose(
    () =>
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const makeUniqueSlug = createUniqueSlugGenerator(RESERVED_MEMO_COMMENTS_ANCHOR_IDS);
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "heading") {
                return;
              }
              const id = makeUniqueSlug(slugify(node.textContent) || FALLBACK_HEADING_SLUG);
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { id }));
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
  );
}
