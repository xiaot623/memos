import { afterEach, describe, expect, it } from "vitest";
import { isReadonlyEditorSurface, suppressReadonlyEditorFocus } from "@/components/MarkdownRuntime/interaction";
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
    expect(prose).toHaveAttribute("tabindex", "-1");
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

describe("isReadonlyEditorSurface", () => {
  it("treats ProseMirror and CodeMirror as editor surfaces", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="ProseMirror"><div class="cm-editor"><div class="cm-content">code</div></div><p>text</p></div>';
    document.body.append(root);
    expect(isReadonlyEditorSurface(root.querySelector("p"))).toBe(true);
    expect(isReadonlyEditorSurface(root.querySelector(".cm-content"))).toBe(true);
    root.remove();
  });

  it("leaves real widgets focusable", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="ProseMirror"><button type="button">Copy</button><a href="/x">link</a></div>';
    document.body.append(root);
    expect(isReadonlyEditorSurface(root.querySelector("button"))).toBe(false);
    expect(isReadonlyEditorSurface(root.querySelector("a"))).toBe(false);
    root.remove();
  });

  it("prevents default when the view surface would take focus", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="ProseMirror"><p>text</p></div>';
    document.body.append(root);
    let prevented = false;
    suppressReadonlyEditorFocus({
      target: root.querySelector("p"),
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(prevented).toBe(true);
    root.remove();
  });
});
