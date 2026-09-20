import { editorViewCtx } from "@milkdown/kit/core";
import { afterEach, describe, expect, it } from "vitest";
import { applyMarkdownEditable } from "@/components/MarkdownRuntime/focus";
import { exclusiveLinkHref } from "@/components/MarkdownRuntime/plugins/linkCard";
import { mountRuntime } from "./markdown-runtime-harness";

describe("link preview gating", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("marks exclusive autolink paragraphs for link cards", async () => {
    const runtime = await mountRuntime("https://example.com");
    runtimes.push(runtime);
    const hrefs: string[] = [];
    runtime.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.state.doc.forEach((node) => {
        const href = exclusiveLinkHref(node);
        if (href) {
          hrefs.push(href);
        }
      });
    });
    expect(hrefs).toContain("https://example.com");
    expect(runtime.root.querySelector("[data-link-card]")).not.toBeNull();
  });

  it("hides link cards while the same editor is writable", async () => {
    const runtime = await mountRuntime("https://example.com", "edit");
    runtimes.push(runtime);
    applyMarkdownEditable(runtime.crepe, false);
    expect(runtime.root.querySelector("[data-link-card]")).not.toBeNull();
    applyMarkdownEditable(runtime.crepe, true);
    expect(runtime.root.querySelector("[data-link-card]")).toBeNull();
  });
});
