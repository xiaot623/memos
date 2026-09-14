import { InputRule } from "@milkdown/kit/prose/inputrules";
import { $inputRule, $markSchema, $remark } from "@milkdown/kit/utils";
import { mentionStyles, tagStyles } from "@/lib/markdownStyles";
import { MENTION_RUN } from "@/utils/mention-grammar";
import { remarkMention } from "@/utils/remark-plugins/remark-mention";
import { remarkTag } from "@/utils/remark-plugins/remark-tag";
import { TAG_RUN } from "@/utils/tag-grammar";

export const remarkTagPlugin = $remark("remark-tag", () => remarkTag);
export const remarkMentionPlugin = $remark("remark-mention", () => remarkMention);

export const tagSchema = $markSchema("tag", () => ({
  attrs: {
    tag: { default: "" },
  },
  inclusive: false,
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
  toDOM: (mark) => [
    "span",
    {
      "data-tag": mark.attrs.tag,
      class: `${tagStyles.base} ${tagStyles.defaultColor} cursor-pointer`,
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === "tagNode",
    runner: (state, node, markType) => {
      const tag = String(node.value ?? "");
      state.openMark(markType, { tag });
      state.addText(`#${tag}`);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "tag",
    runner: () => {
      // Text already contains `#tag`.
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
    const mark = type.create({ tag });
    return state.tr.addMark(start, end - 1, mark);
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
