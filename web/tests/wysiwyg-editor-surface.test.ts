import { afterEach, describe, expect, it } from "vitest";
import { mountRuntime } from "./markdown-runtime-harness";

describe("WYSIWYG editor surface", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("mounts an editable ProseMirror surface with a document placeholder", async () => {
    const runtime = await mountRuntime("", "edit", "此刻的想法...");
    runtimes.push(runtime);

    const prose = runtime.root.querySelector<HTMLElement>(".ProseMirror");
    expect(prose).not.toBeNull();
    expect(prose).toHaveAttribute("contenteditable", "true");
    expect(prose).not.toHaveAttribute("contenteditable", "false");

    const placeholder = runtime.root.querySelector(".crepe-placeholder");
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveAttribute("data-placeholder", "此刻的想法...");
  });

  it("does not mount the slash menu or block handle", async () => {
    const runtime = await mountRuntime("", "edit");
    runtimes.push(runtime);

    expect(runtime.root.querySelector(".milkdown-slash-menu")).toBeNull();
    expect(runtime.root.querySelector(".milkdown-block-handle")).toBeNull();
    expect(document.querySelector(".milkdown-slash-menu")).toBeNull();
    expect(document.querySelector(".milkdown-block-handle")).toBeNull();
  });
});
