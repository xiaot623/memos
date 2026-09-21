import { describe, expect, it } from "vitest";
import { needsRawMarkdown } from "@/components/MarkdownRuntime/unsupportedSyntax";

describe("needsRawMarkdown", () => {
  it("allows ordinary GFM and trusted iframes", () => {
    expect(needsRawMarkdown("# Title\n\n- [ ] task\n\n`code`")).toBe(false);
    expect(needsRawMarkdown('<iframe src="https://www.youtube.com/embed/abc"></iframe>')).toBe(false);
    expect(needsRawMarkdown("![alt](https://example.com/a.png)\n\n<img src='https://example.com/a.png'>")).toBe(false);
  });

  it("flags arbitrary HTML and comments", () => {
    expect(needsRawMarkdown("<script>alert(1)</script>")).toBe(true);
    expect(needsRawMarkdown("<!-- secret -->")).toBe(true);
    expect(needsRawMarkdown('<div onclick="alert(1)">x</div>')).toBe(true);
  });

  it("ignores HTML that only appears inside fenced code", () => {
    expect(needsRawMarkdown("```html\n<script>alert(1)</script>\n```")).toBe(false);
  });
});
