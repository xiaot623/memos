import { editorViewCtx } from "@milkdown/kit/core";
import { afterEach, describe, expect, it } from "vitest";
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
});
