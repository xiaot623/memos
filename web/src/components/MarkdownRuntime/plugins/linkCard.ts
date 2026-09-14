import type { Node } from "@milkdown/kit/prose/model";
import { Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export function exclusiveLinkHref(node: Node): string | undefined {
  if (node.type.name !== "paragraph" || node.childCount !== 1) {
    return undefined;
  }
  const child = node.child(0);
  if (!child.isText || !child.text) {
    return undefined;
  }
  const link = child.marks.find((mark) => mark.type.name === "link");
  if (!link) {
    return undefined;
  }
  const href = String(link.attrs.href ?? "");
  if (!href || child.text !== href) {
    return undefined;
  }
  return href;
}

export function createLinkCardPlugin() {
  return $prose(
    () =>
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.forEach((node, offset) => {
              const href = exclusiveLinkHref(node);
              if (!href) {
                return;
              }
              decorations.push(
                Decoration.widget(
                  offset,
                  () => {
                    const host = document.createElement("div");
                    host.dataset.linkCard = href;
                    host.className = "link-card-host my-0 mb-2 w-full";
                    return host;
                  },
                  { side: -1 },
                ),
              );
              decorations.push(Decoration.node(offset, offset + node.nodeSize, { class: "link-card-source" }));
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
  );
}
