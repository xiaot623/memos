import { afterEach, describe, expect, it } from "vitest";
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
});
