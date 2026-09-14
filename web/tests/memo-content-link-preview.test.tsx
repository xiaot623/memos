import { editorViewCtx } from "@milkdown/kit/core";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { afterEach, describe, expect, it } from "vitest";
import { exclusiveLinkHref } from "@/components/MarkdownRuntime/plugins/linkCard";
import { getSingleLinkHref } from "@/components/MemoContent/markdown/Paragraph";
import { mountRuntime } from "./markdown-runtime-harness";

const collectSingleLinkHrefs = (content: string): Array<string | undefined> => {
  const hrefs: Array<string | undefined> = [];
  renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children, node }) => {
          hrefs.push(getSingleLinkHref(node));
          return <p>{children}</p>;
        },
      }}
    >
      {content}
    </ReactMarkdown>,
  );
  return hrefs;
};

describe("link preview gating", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("treats only bare single-link paragraphs as preview candidates", () => {
    expect(collectSingleLinkHrefs("https://www.bilibili.com/\n\n[bilibili](https://www.bilibili.com/)")).toEqual([
      "https://www.bilibili.com/",
      undefined,
    ]);
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
