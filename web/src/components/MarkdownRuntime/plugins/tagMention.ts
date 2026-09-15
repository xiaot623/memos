import { remarkStringifyOptionsCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import { $inputRule, $markSchema, $nodeSchema, $remark } from "@milkdown/kit/utils";
import { mentionStyles, tagStyles } from "@/lib/markdownStyles";
import { MENTION_RUN } from "@/utils/mention-grammar";
import { remarkMention } from "@/utils/remark-plugins/remark-mention";
import { remarkTag } from "@/utils/remark-plugins/remark-tag";
import { TAG_RUN } from "@/utils/tag-grammar";

export const remarkTagPlugin = $remark("remark-tag", () => remarkTag);
export const remarkMentionPlugin = $remark("remark-mention", () => remarkMention);

export const tagSchema = $nodeSchema("tag", () => ({
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
      class: tagStyles.defaultColor,
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

export const mentionSchema = $markSchema("mention", () => ({
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

const TAG_INPUT = new RegExp(`#(${TAG_RUN})\\s$`, "u");
const MENTION_INPUT = new RegExp(`@(${MENTION_RUN})\\s$`, "u");

export const tagInputRule = $inputRule((ctx) => {
  const type = tagSchema.type(ctx);
  return new InputRule(TAG_INPUT, (state, match, start, end) => {
    const tag = match[1];
    if (!tag) {
      return null;
    }
    return state.tr.replaceWith(start, end - 1, type.create({ tag }));
  });
});

export const mentionInputRule = $inputRule((ctx) => {
  const type = mentionSchema.type(ctx);
  return new InputRule(MENTION_INPUT, (state, match, start, end) => {
    const username = match[1]?.toLowerCase();
    if (!username) {
      return null;
    }
    const mark = type.create({ username });
    return state.tr.addMark(start, end - 1, mark);
  });
});

export const tagMentionPlugins = [remarkTagPlugin, remarkMentionPlugin, tagSchema, mentionSchema, tagInputRule, mentionInputRule];

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
