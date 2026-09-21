import type { Ctx } from "@milkdown/kit/ctx";
import { footnoteDefinitionSchema, footnoteReferenceSchema } from "@milkdown/kit/preset/gfm";
import type { Node } from "@milkdown/kit/prose/model";

function footnoteId(label: string): string {
  return `user-content-fn-${label}`;
}

function footnoteRefId(label: string): string {
  return `user-content-fnref-${label}`;
}

export function configureFootnoteDom(ctx: Ctx): void {
  ctx.update(footnoteReferenceSchema.key, (prev) => (inner) => {
    const schema = prev(inner);
    return {
      ...schema,
      toDOM: (node: Node) => {
        const label = String(node.attrs.label ?? "");
        return [
          "sup",
          {
            "data-type": "footnote_reference",
            "data-label": label,
            id: footnoteRefId(label),
          },
          [
            "a",
            {
              href: `#${footnoteId(label)}`,
              "data-footnote-ref": "",
            },
            label,
          ],
        ];
      },
    };
  });
  ctx.update(footnoteDefinitionSchema.key, (prev) => (inner) => {
    const schema = prev(inner);
    return {
      ...schema,
      toDOM: (node: Node) => {
        const label = String(node.attrs.label ?? "");
        return [
          "dl",
          {
            "data-type": "footnote_definition",
            "data-label": label,
            id: footnoteId(label),
          },
          ["dt", label],
          ["dd", 0],
        ];
      },
    };
  });
}
