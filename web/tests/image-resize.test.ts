import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeImageDisplaySize,
  computeResizedWidth,
  IMAGE_RESIZE_GRIP_CLASS,
  IMAGE_RESIZE_HANDLES,
} from "@/components/MarkdownRuntime/plugins/imageResize";
import { mountRuntime } from "./markdown-runtime-harness";

const PIXEL_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

describe("computeImageDisplaySize", () => {
  it("caps a narrow image at the editor width when scaling up", () => {
    expect(
      computeImageDisplaySize({
        naturalWidth: 200,
        naturalHeight: 100,
        editorWidth: 800,
        ratio: 8,
      }),
    ).toEqual({ width: 800, height: 400, originWidth: 200 });
  });

  it("uses the editor width when a wide image is at ratio 1", () => {
    expect(
      computeImageDisplaySize({
        naturalWidth: 1600,
        naturalHeight: 800,
        editorWidth: 400,
        ratio: 1,
      }),
    ).toEqual({ width: 400, height: 200, originWidth: 400 });
  });

  it("halves a fitted wide image at ratio 0.5", () => {
    expect(
      computeImageDisplaySize({
        naturalWidth: 1600,
        naturalHeight: 800,
        editorWidth: 400,
        ratio: 0.5,
      }),
    ).toEqual({ width: 200, height: 100, originWidth: 400 });
  });

  it("clamps a ratio that would exceed the editor", () => {
    expect(
      computeImageDisplaySize({
        naturalWidth: 1600,
        naturalHeight: 800,
        editorWidth: 400,
        ratio: 2,
      }).width,
    ).toBe(400);
  });
});

describe("computeResizedWidth", () => {
  const fitted = {
    startWidth: 400,
    startHeight: 200,
    startPointerX: 400,
    startPointerY: 200,
    naturalWidth: 1600,
    naturalHeight: 800,
    editorWidth: 400,
  };

  it("scales proportionally from the east edge and clamps to the editor", () => {
    expect(computeResizedWidth({ ...fitted, handle: "e", pointerX: 300, pointerY: 200 })).toBe(300);
    expect(computeResizedWidth({ ...fitted, handle: "e", pointerX: 520, pointerY: 200 })).toBe(400);
  });

  it("keeps aspect ratio when dragging a corner", () => {
    expect(computeResizedWidth({ ...fitted, handle: "se", pointerX: 300, pointerY: 250 })).toBe(300);
  });
});

describe("image resize plugin", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("mounts eight resize grips in edit mode and none in view mode", async () => {
    const markdown = `![1.00](${PIXEL_GIF})`;
    const edit = await mountRuntime(markdown, "edit");
    runtimes.push(edit);
    const editWrapper = await waitForImageWrapper(edit.root);
    expect(gripsOf(editWrapper)).toHaveLength(IMAGE_RESIZE_HANDLES.length);

    const view = await mountRuntime(markdown, "view");
    runtimes.push(view);
    const viewWrapper = await waitForImageWrapper(view.root);
    expect(gripsOf(viewWrapper)).toHaveLength(0);
  });

  it("writes a clamped ratio into markdown after an east-handle drag", async () => {
    const runtime = await mountRuntime(`![1.00](${PIXEL_GIF})`, "edit");
    runtimes.push(runtime);

    const wrapper = await waitForImageWrapper(runtime.root);
    const img = wrapper.querySelector("img");
    const block = wrapper.closest(".milkdown-image-block");
    expect(img).not.toBeNull();
    expect(block).not.toBeNull();
    if (!img || !block) {
      return;
    }

    stubNaturalSize(img, 1600, 800);
    mockBox(block, 400, 200);
    mockBox(img, 400, 200);
    img.dispatchEvent(new Event("load"));

    const east = wrapper.querySelector<HTMLElement>(`.${IMAGE_RESIZE_GRIP_CLASS}[data-resize="e"]`);
    expect(east).not.toBeNull();
    east?.dispatchEvent(pointer("pointerdown", 400, 100));
    window.dispatchEvent(pointer("pointermove", 300, 100));
    window.dispatchEvent(pointer("pointerup", 300, 100));

    expect(runtime.crepe.getMarkdown()).toMatch(/!\[0\.75\]/);
  });
});

async function waitForImageWrapper(root: HTMLElement) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const wrapper = root.querySelector<HTMLElement>(".milkdown-image-block .image-wrapper");
    if (wrapper) {
      return wrapper;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("image block did not mount");
}

function gripsOf(wrapper: HTMLElement) {
  return [...wrapper.querySelectorAll(`.${IMAGE_RESIZE_GRIP_CLASS}`)];
}

function stubNaturalSize(img: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(img, "naturalWidth", { configurable: true, get: () => width });
  Object.defineProperty(img, "naturalHeight", { configurable: true, get: () => height });
  Object.defineProperty(img, "complete", { configurable: true, get: () => true });
}

function mockBox(el: Element, width: number, height: number) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function pointer(type: string, clientX: number, clientY: number) {
  return new PointerEvent(type, { bubbles: true, clientX, clientY });
}
