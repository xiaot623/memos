import { afterEach, describe, expect, it, vi } from "vitest";
import { mountRuntime } from "./markdown-runtime-harness";

describe("markdown file paste", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("routes pasted files to onFiles instead of inserting an image block", async () => {
    const onFiles = vi.fn();
    const runtime = await mountRuntime("memo", "edit", "", onFiles);
    runtimes.push(runtime);

    const prose = runtime.root.querySelector<HTMLElement>(".ProseMirror");
    expect(prose).not.toBeNull();
    if (!prose) {
      return;
    }

    const file = new File(["image-bytes"], "photo.png", { type: "image/png" });
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        items: [{ kind: "file", getAsFile: () => file }],
        files: [file],
      },
    });
    prose.dispatchEvent(event);

    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(event.defaultPrevented).toBe(true);
    expect(runtime.root.querySelector(".milkdown-image-block")).toBeNull();
    expect(runtime.crepe.getMarkdown()).not.toMatch(/blob:/);
    expect(runtime.crepe.getMarkdown()).toMatch(/memo/);
  });
});
