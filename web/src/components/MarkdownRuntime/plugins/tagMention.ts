import { remarkStringifyOptionsCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import { $inputRule, $markSchema, $nodeSchema, $remark } from "@milkdown/kit/utils";
import { mentionStyles, tagStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import { remarkMemoSyntax } from "@/utils/remark-plugins/remark-tag";
import { scanTagAt } from "@/utils/tag-grammar";
import { isValidUsername } from "@/utils/username";

const remarkMemoSyntaxPlugin = $remark("remark-memo-syntax", () => remarkMemoSyntax);

const tagSchema = $nodeSchema("tag", () => ({
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: true,
  marks: "",
  attrs: {
    tag: { default: "" },
  },
  leafText: (node) => `#${node.attrs.tag}`,
  parseDOM: [
    {
      tag: "span[data-tag]",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) {
          return false;
        }
        return { tag: dom.dataset.tag ?? "" };
      },
    },
  ],
  toDOM: (node) => [
    "span",
    {
      "data-tag": node.attrs.tag,
      class: cn(tagStyles.base, tagStyles.defaultColor),
    },
    `#${node.attrs.tag}`,
  ],
  parseMarkdown: {
    match: (node) => node.type === "tagNode",
    runner: (state, node, nodeType) => {
      state.addNode(nodeType, { tag: String(node.value ?? node.tag ?? "") });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "tag",
    runner: (state, node) => {
      const tag = String(node.attrs.tag ?? "");
      state.addNode("tagNode", undefined, tag, { tag, value: tag });
    },
  },
}));

const mentionSchema = $markSchema("mention", () => ({
  attrs: {
    username: { default: "" },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: "span[data-mention], a[data-mention]",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) {
          return false;
        }
        return { username: dom.dataset.mention ?? "" };
      },
    },
  ],
  toDOM: (mark) => [
    "span",
    {
      "data-mention": mark.attrs.username,
      class: mentionStyles.base,
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === "mentionNode",
    runner: (state, node, markType) => {
      const username = String(node.value ?? "");
      state.openMark(markType, { username });
      state.addText(`@${username}`);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "mention",
    runner: () => {
      // Text already contains `@username`.
    },
  },
}));

const TAG_INPUT = /#(\S+)\s$/u;
const MENTION_INPUT = /@([A-Za-z0-9-]{1,36})\s$/;

const tagInputRule = $inputRule((ctx) => {
  const type = tagSchema.type(ctx);
  return new InputRule(TAG_INPUT, (state, match, start, end) => {
    const tag = match[1];
    if (!tag) {
      return null;
    }
    const scanned = scanTagAt(`#${tag}`, 0);
    if (!scanned || scanned.value !== tag) {
      return null;
    }
    return state.tr.replaceWith(start, end - 1, type.create({ tag: scanned.value }));
  });
});

const mentionInputRule = $inputRule((ctx) => {
  const type = mentionSchema.type(ctx);
  return new InputRule(MENTION_INPUT, (state, match, start, end) => {
    const username = match[1]?.toLowerCase();
    if (!username || !isValidUsername(username)) {
      return null;
    }
    const mark = type.create({ username });
    return state.tr.addMark(start, end - 1, mark);
  });
});

export const tagMentionPlugins = [remarkMemoSyntaxPlugin, tagSchema, mentionSchema, tagInputRule, mentionInputRule];

/** Write `#tag` as a literal so a tag-only memo is not saved as `\#tag`. */
export function configureTagMarkdown(ctx: Ctx): void {
  ctx.update(remarkStringifyOptionsCtx, (prev) => ({
    ...prev,
    handlers: {
      ...prev.handlers,
      tagNode: (node: { tag?: unknown; value?: unknown }) => `#${String(node.tag ?? node.value ?? "")}`,
    },
  }));
}
