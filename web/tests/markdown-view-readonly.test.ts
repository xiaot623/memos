import { afterEach, describe, expect, it } from "vitest";
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
});
