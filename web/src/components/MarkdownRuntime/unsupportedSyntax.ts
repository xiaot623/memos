const FENCE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const INLINE_CODE = /`(?:\\.|[^`\n])+`/g;

/** HTML tags Milkdown can keep without a raw-mode fallback. */
const SAFE_HTML_TAG = /^(iframe|img|br|hr)$/i;

const HTML_TAG = /<\/?([a-z][\w:-]*)\b[^>]*>/gi;

function stripCode(content: string): string {
  return content.replace(FENCE, "").replace(INLINE_CODE, "");
}

/**
 * True when the markdown contains constructs the WYSIWYG schema cannot round-trip
 * safely (arbitrary HTML, comments). Trusted iframes/images stay in WYSIWYG.
 */
export function needsRawMarkdown(content: string): boolean {
  if (!content) {
    return false;
  }

  const stripped = stripCode(content);
  if (stripped.includes("<!--")) {
    return true;
  }

  HTML_TAG.lastIndex = 0;
  let match = HTML_TAG.exec(stripped);
  while (match) {
    const tag = match[1];
    if (!SAFE_HTML_TAG.test(tag)) {
      return true;
    }
    match = HTML_TAG.exec(stripped);
  }

  return false;
}
