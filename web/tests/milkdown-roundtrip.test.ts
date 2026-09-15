import { editorViewCtx } from "@milkdown/kit/core";
import { afterEach, describe, expect, it } from "vitest";
import { addTag } from "@/utils/tag-markdown";
import { mountRuntime } from "./markdown-runtime-harness";

describe("Milkdown markdown round-trip", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("keeps headings, lists, tags, mentions, tasks, and tables in serialized markdown", async () => {
    const markdown = "## Title\n\n- item\n- [ ] task\n\n#work and @alice\n\n| a | b |\n| --- | --- |\n| 1 | 2 |";
    const runtime = await mountRuntime(markdown, "edit");
    runtimes.push(runtime);
    const next = runtime.crepe.getMarkdown();
    expect(next).toContain("Title");
    expect(next).toMatch(/item/);
    expect(next).toMatch(/task/);
    expect(next).toContain("#work");
    expect(next).toContain("@alice");
    expect(next).toMatch(/\|/);
  });

  it("serializes a picker-appended tag as a literal hash, covering the full chip", async () => {
    const markdown = addTag("hello", "inbox");
    const runtime = await mountRuntime(markdown, "edit");
    runtimes.push(runtime);
    const next = runtime.crepe.getMarkdown();
    expect(next).toContain("#inbox");
    expect(next).not.toContain("\\#inbox");
    const chip = runtime.root.querySelector('[data-tag="inbox"]');
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toBe("#inbox");
  });

  it("serializes a tag-only document without escaping the hash", async () => {
    const runtime = await mountRuntime(addTag("", "inbox"), "edit");
    runtimes.push(runtime);
    const next = runtime.crepe.getMarkdown();
    expect(next).toContain("#inbox");
    expect(next).not.toContain("\\#inbox");
    expect(runtime.root.querySelector('[data-tag="inbox"]')?.textContent).toBe("#inbox");
  });

  it("treats a tag as an atom that deletes in one step", async () => {
    const runtime = await mountRuntime("hello #inbox", "edit");
    runtimes.push(runtime);
    runtime.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      let tagPos = -1;
      let tagSize = 0;
      view.state.doc.descendants((node, pos) => {
        if (node.type.name !== "tag") {
          return;
        }
        expect(node.isAtom).toBe(true);
        tagPos = pos;
        tagSize = node.nodeSize;
        return false;
      });
      expect(tagPos).toBeGreaterThanOrEqual(0);
      view.dispatch(view.state.tr.delete(tagPos, tagPos + tagSize));
    });
    expect(runtime.crepe.getMarkdown()).not.toContain("#inbox");
    expect(runtime.crepe.getMarkdown()).toContain("hello");
  });
});
