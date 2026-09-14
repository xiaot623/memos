import { afterEach, describe, expect, it } from "vitest";
import { createMarkdownRuntime } from "@/components/MarkdownRuntime/createRuntime";

describe("Milkdown markdown round-trip", () => {
  let destroy: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await destroy?.();
    destroy = undefined;
  });

  it("keeps headings, lists, tags, mentions, tasks, and tables in serialized markdown", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const markdown = "## Title\n\n- item\n- [ ] task\n\n#work and @alice\n\n| a | b |\n| --- | --- |\n| 1 | 2 |";
    const crepe = createMarkdownRuntime({
      root,
      defaultValue: markdown,
      mode: "edit",
    });
    destroy = async () => {
      await crepe.destroy();
      root.remove();
    };
    await crepe.create();
    const next = crepe.getMarkdown();
    expect(next).toContain("Title");
    expect(next).toMatch(/item/);
    expect(next).toMatch(/task/);
    expect(next).toContain("#work");
    expect(next).toContain("@alice");
    expect(next).toMatch(/\|/);
  });
});
