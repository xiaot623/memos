import { editorViewCtx } from "@milkdown/kit/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyMarkdownEditable } from "@/components/MarkdownRuntime/focus";
import { mountRuntime } from "./markdown-runtime-harness";

describe("markdown view readonly surface", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("mounts a non-editable ProseMirror document in view mode", async () => {
    const runtime = await mountRuntime("# title\n\nparagraph", "view");
    runtimes.push(runtime);

    const prose = runtime.root.querySelector<HTMLElement>(".ProseMirror");
    expect(prose).not.toBeNull();
    expect(runtime.crepe.readonly).toBe(true);
    expect(prose).toHaveAttribute("contenteditable", "false");
  });

  it("keeps the editor surface editable in edit mode", async () => {
    const runtime = await mountRuntime("paragraph", "edit");
    runtimes.push(runtime);

    const prose = runtime.root.querySelector<HTMLElement>(".ProseMirror");
    expect(prose).not.toBeNull();
    expect(runtime.crepe.readonly).toBe(false);
    expect(prose).toHaveAttribute("contenteditable", "true");
  });

  it("flips readonly on the same editor instance", async () => {
    const runtime = await mountRuntime("hello world", "edit");
    runtimes.push(runtime);
    applyMarkdownEditable(runtime.crepe, false);
    expect(runtime.root.querySelector(".ProseMirror")).toHaveAttribute("contenteditable", "false");

    applyMarkdownEditable(runtime.crepe, true);
    expect(runtime.root.querySelector(".ProseMirror")).toHaveAttribute("contenteditable", "true");
  });

  it("places the caret from screen coordinates without remounting", async () => {
    const runtime = await mountRuntime("hello world", "edit");
    runtimes.push(runtime);

    runtime.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const posAtCoords = vi.spyOn(view, "posAtCoords").mockReturnValue({ pos: 6, inside: 1 });
      const focus = vi.spyOn(view.dom, "focus");
      applyMarkdownEditable(runtime.crepe, true, { x: 12, y: 40 });
      expect(posAtCoords).toHaveBeenCalledWith({ left: 12, top: 40 });
      expect(view.state.selection.head).toBe(6);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });
  });
});
