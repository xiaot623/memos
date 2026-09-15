import type { Text } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { SKIP, visit } from "unist-util-visit";
import { isTagChar, MAX_TAG_LENGTH, TAG_RUN } from "./tag-grammar";

const SKIP_TYPES = new Set(["code", "inlineCode", "html", "link", "linkReference", "image", "imageReference", "definition"]);

const TAG_TOKEN = new RegExp(`#(${TAG_RUN})`, "gu");

export interface TagRange {
  tag: string;
  start: number;
  end: number;
}

function isEscapedHash(source: string, index: number): boolean {
  let count = 0;
  for (let i = index - 1; i >= 0 && source[i] === "\\"; i--) {
    count++;
  }
  return count % 2 === 1;
}

/** Strip a leading `#` and surrounding whitespace from a picker/search value. */
export function normalizeTagName(tag: string): string {
  return tag.trim().replace(/^#+/, "");
}

/** Whether `tag` is a legal memos tag name (no leading `#`). */
export function isValidTagName(tag: string): boolean {
  const runes = [...tag];
  return runes.length > 0 && runes.length <= MAX_TAG_LENGTH && runes.every((rune) => isTagChar(rune));
}

/**
 * Source ranges of `#tag` tokens that remark-tag / goldmark would extract.
 * Skips code, HTML, links, images, and CommonMark-escaped hashes.
 */
export function findTagRanges(markdown: string): TagRange[] {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const ranges: TagRange[] = [];

  visit(tree, (node) => {
    if (SKIP_TYPES.has(node.type)) {
      return SKIP;
    }
    if (node.type !== "text") {
      return;
    }
    const textNode = node as Text;
    const startOffset = textNode.position?.start?.offset;
    const endOffset = textNode.position?.end?.offset;
    if (startOffset == null || endOffset == null) {
      return;
    }

    const slice = markdown.slice(startOffset, endOffset);
    TAG_TOKEN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TAG_TOKEN.exec(slice)) !== null) {
      const tag = match[1];
      if (!tag) {
        continue;
      }
      const abs = startOffset + match.index;
      if (isEscapedHash(markdown, abs)) {
        continue;
      }
      if (abs > 0 && markdown[abs - 1] === "#") {
        continue;
      }
      ranges.push({ tag, start: abs, end: abs + match[0].length });
    }
  });

  return ranges;
}

/** Unique tags in document order. */
export function listTags(markdown: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const range of findTagRanges(markdown)) {
    if (seen.has(range.tag)) {
      continue;
    }
    seen.add(range.tag);
    tags.push(range.tag);
  }
  return tags;
}

export function hasTag(markdown: string, tag: string): boolean {
  const name = normalizeTagName(tag);
  return findTagRanges(markdown).some((range) => range.tag === name);
}

function appendPrefix(markdown: string): string {
  if (!markdown) {
    return "";
  }
  const withoutTrailingSpaces = markdown.replace(/[ \t]+$/, "");
  if (!withoutTrailingSpaces) {
    return "";
  }
  const lastLine = withoutTrailingSpaces.split("\n").pop() ?? "";
  if (lastLine === "") {
    return withoutTrailingSpaces;
  }
  if (/^ {0,3}#{1,6}\s/.test(lastLine) || /^ {0,3}(?:```|~~~)/.test(lastLine) || /^\s*\|/.test(lastLine)) {
    return `${withoutTrailingSpaces}\n`;
  }
  return `${withoutTrailingSpaces} `;
}

/** Append `#tag` at the end of the document when it is not already present. */
export function addTag(markdown: string, tag: string): string {
  const name = normalizeTagName(tag);
  if (!isValidTagName(name) || hasTag(markdown, name)) {
    return markdown;
  }
  return `${appendPrefix(markdown)}#${name}`;
}

function removalSpan(markdown: string, start: number, end: number): { start: number; end: number } {
  const before = start > 0 ? markdown[start - 1] : "";
  const after = end < markdown.length ? markdown[end] : "";
  if (before === " " && (after === "" || after === " " || after === "\n")) {
    return { start: start - 1, end };
  }
  if ((before === "" || before === "\n") && after === " ") {
    return { start, end: end + 1 };
  }
  return { start, end };
}

/** Remove every complete `#tag` token. Leaves `#tagfoo` and code/link hashes alone. */
export function removeTag(markdown: string, tag: string): string {
  const name = normalizeTagName(tag);
  if (!name) {
    return markdown;
  }
  const ranges = findTagRanges(markdown).filter((range) => range.tag === name);
  let next = markdown;
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];
    if (!range) {
      continue;
    }
    const span = removalSpan(next, range.start, range.end);
    next = `${next.slice(0, span.start)}${next.slice(span.end)}`;
  }
  return next;
}
