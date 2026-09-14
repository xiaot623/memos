import type { Ctx } from "@milkdown/kit/ctx";
import { htmlSchema } from "@milkdown/kit/preset/commonmark";
import type { Node } from "@milkdown/kit/prose/model";
import { isTrustedIframeSrc } from "@/components/MemoContent/constants";

const ATTR = /([a-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR.lastIndex = 0;
  let match = ATTR.exec(raw);
  while (match) {
    const name = match[1]?.toLowerCase();
    if (name) {
      attrs[name] = match[2] ?? match[3] ?? match[4] ?? "";
    }
    match = ATTR.exec(raw);
  }
  return attrs;
}

function parseVoidTag(html: string, tag: string): Record<string, string> | null {
  const re = new RegExp(`^<${tag}\\b([^>]*)\\/?>\\s*(?:</${tag}\\s*>)?$`, "i");
  const match = html.trim().match(re);
  if (!match) {
    return null;
  }
  return parseAttrs(match[1] ?? "");
}

function hiddenHtml(value: string): [string, Record<string, string>] {
  return ["span", { "data-type": "html", "data-value": value, hidden: "true" }];
}

export function htmlToDOM(node: Node): [string, Record<string, string>] {
  const value = String(node.attrs.value ?? "");
  const iframe = parseVoidTag(value, "iframe");
  if (iframe?.src && isTrustedIframeSrc(iframe.src)) {
    const attrs: Record<string, string> = {
      src: iframe.src,
      class: "max-w-full rounded-lg border border-border",
      loading: iframe.loading || "lazy",
      referrerpolicy: iframe.referrerpolicy || "no-referrer",
    };
    if (iframe.title) {
      attrs.title = iframe.title;
    }
    if (iframe.width) {
      attrs.width = iframe.width;
    }
    if (iframe.height) {
      attrs.height = iframe.height;
    }
    if (iframe.allow) {
      attrs.allow = iframe.allow;
    }
    if (iframe.allowfullscreen !== undefined || /allowfullscreen/i.test(value)) {
      attrs.allowfullscreen = "true";
    }
    return ["iframe", attrs];
  }

  const image = parseVoidTag(value, "img");
  if (image?.src && /^https:/i.test(image.src)) {
    return [
      "img",
      {
        src: image.src,
        alt: image.alt ?? "",
        title: image.title ?? "",
        class: "max-w-full rounded-lg",
      },
    ];
  }

  if (parseVoidTag(value, "br")) {
    return ["br", {}];
  }
  if (parseVoidTag(value, "hr")) {
    return ["hr", { class: "my-2 h-0 border-0 border-b border-border" }];
  }

  return hiddenHtml(value);
}

export function configureTrustedHtml(ctx: Ctx): void {
  ctx.update(htmlSchema.key, (prev) => (inner) => ({
    ...prev(inner),
    toDOM: htmlToDOM,
  }));
}
