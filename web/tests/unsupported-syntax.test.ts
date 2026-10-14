import { editorViewCtx } from "@milkdown/kit/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasHiddenHtml } from "@/components/MarkdownRuntime/plugins/html";
import { mountRuntime } from "./markdown-runtime-harness";

describe("Milkdown hidden HTML", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  async function open(markdown: string) {
    const runtime = await mountRuntime(markdown, "edit");
    runtimes.push(runtime);
    let hidden = false;
    runtime.crepe.editor.action((ctx) => {
      hidden = hasHiddenHtml(ctx.get(editorViewCtx).state.doc);
    });
    return { hidden, root: runtime.root };
  }

  it("keeps ordinary GFM and trusted HTML in the rich editor", async () => {
    expect((await open("# Title\n\n- [ ] task\n\n`code`")).hidden).toBe(false);

    const iframe = await open('<iframe src="https://www.youtube.com/embed/abc"></iframe>');
    expect(iframe.hidden).toBe(false);
    expect(iframe.root.querySelector("iframe")).not.toBeNull();

    const image = await open("![alt](https://example.com/a.png)\n\n<img src='https://example.com/a.png'>");
    expect(image.hidden).toBe(false);
    expect(image.root.querySelector("img")).not.toBeNull();
  });

  it("keeps angle-bracket links as links", async () => {
    const markdown = [
      "管理页：<http://192.168.123.241/> 和 <https://192.168.123.241/>",
      "<https://example.com>",
      "<mailto:user@example.com>",
      "<user@example.com>",
      "[x](<https://example.com>)",
    ].join("\n\n");
    const doc = await open(markdown);
    expect(doc.hidden).toBe(false);
    expect(doc.root.querySelector('[data-type="html"]')).toBeNull();
    expect(doc.root.querySelectorAll('a[href="http://192.168.123.241/"]')).toHaveLength(1);
    expect(doc.root.querySelectorAll('a[href="https://192.168.123.241/"]')).toHaveLength(1);
    expect(doc.root.querySelectorAll('a[href="https://example.com"]')).toHaveLength(2);
    expect(doc.root.querySelectorAll('a[href="mailto:user@example.com"]')).toHaveLength(2);
  });

  it("flags HTML the rich editor would hide", async () => {
    expect((await open("<script>alert(1)</script>")).hidden).toBe(true);
    expect((await open("<!-- secret -->")).hidden).toBe(true);
    expect((await open('<div onclick="alert(1)">x</div>')).hidden).toBe(true);
  });

  it("ignores HTML that only appears inside fenced code", async () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    const doc = await open("```html\n<script>alert(1)</script>\n```");
    expect(doc.hidden).toBe(false);
    expect(doc.root.querySelector('[data-type="html"]')).toBeNull();
  });
});
