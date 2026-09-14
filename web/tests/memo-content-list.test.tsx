import { afterEach, describe, expect, it } from "vitest";
import { mountRuntime } from "./markdown-runtime-harness";

describe("memo content lists", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("keeps task items and regular bullets as separate list structures", async () => {
    const runtime = await mountRuntime("- [ ] pickup package\n- [ ] library returns\n\n- milk\n- eggs\n- bread");
    runtimes.push(runtime);

    const tasks = runtime.root.querySelectorAll(".milkdown-list-item-block .unchecked, .milkdown-list-item-block .checked");
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(runtime.root).toHaveTextContent("pickup package");
    expect(runtime.root).toHaveTextContent("milk");
    expect(runtime.root).toHaveTextContent("eggs");
  });

  it("preserves checked state for GFM task list items", async () => {
    const runtime = await mountRuntime("- [x] Done\n- [ ] Todo");
    runtimes.push(runtime);

    const blocks = [...runtime.root.querySelectorAll(".milkdown-list-item-block")].filter((el) => el.querySelector(".checked, .unchecked"));
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0]?.querySelector(".checked")).not.toBeNull();
    expect(blocks[1]?.querySelector(".unchecked")).not.toBeNull();
  });

  it("keeps nested task lists", async () => {
    const runtime = await mountRuntime("- [ ] asdas\n  - [ ] zzzz");
    runtimes.push(runtime);

    const tasks = [...runtime.root.querySelectorAll(".milkdown-list-item-block")].filter((el) => el.querySelector(".checked, .unchecked"));
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(runtime.root).toHaveTextContent("asdas");
    expect(runtime.root).toHaveTextContent("zzzz");
  });

  it("keeps inline markdown in the task body", async () => {
    const runtime = await mountRuntime("- [ ] Northern Lights in Iceland — booking this for winter, *finally*");
    runtimes.push(runtime);

    expect(runtime.root.querySelector(".milkdown-list-item-block")).not.toBeNull();
    expect(runtime.root.querySelector("em, i")).not.toBeNull();
    expect(runtime.root).toHaveTextContent("finally");
  });
});
