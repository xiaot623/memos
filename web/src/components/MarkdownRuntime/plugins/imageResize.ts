import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export const IMAGE_RESIZE_GRIP_CLASS = "image-resize-grip";
export const IMAGE_RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type ImageResizeHandle = (typeof IMAGE_RESIZE_HANDLES)[number];

const MIN_SIZE = 100;
const IMAGE_BLOCK = "image-block";

interface ComputeImageDisplaySizeInput {
  naturalWidth: number;
  naturalHeight: number;
  editorWidth: number;
  ratio: number;
  minSize?: number;
}

interface ImageDisplaySize {
  width: number;
  height: number;
  originWidth: number;
}

/** Map stored ImageBlock ratio onto a width that never exceeds the editor. */
export function computeImageDisplaySize({
  naturalWidth,
  naturalHeight,
  editorWidth,
  ratio,
  minSize = MIN_SIZE,
}: ComputeImageDisplaySizeInput): ImageDisplaySize {
  if (naturalWidth <= 0 || naturalHeight <= 0 || editorWidth <= 0) {
    return { width: 0, height: 0, originWidth: 0 };
  }

  const originWidth = Math.min(naturalWidth, editorWidth);
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const minWidth = Math.min(minSize, editorWidth);
  const width = Math.min(editorWidth, Math.max(minWidth, originWidth * safeRatio));
  const height = width * (naturalHeight / naturalWidth);
  return { width, height, originWidth };
}

interface ComputeResizedWidthInput {
  handle: ImageResizeHandle;
  startWidth: number;
  startHeight: number;
  startPointerX: number;
  startPointerY: number;
  pointerX: number;
  pointerY: number;
  naturalWidth: number;
  naturalHeight: number;
  editorWidth: number;
  minSize?: number;
}

/** Keep aspect ratio for every handle; clamp to the current editor width. */
export function computeResizedWidth({
  handle,
  startWidth,
  startHeight,
  startPointerX,
  startPointerY,
  pointerX,
  pointerY,
  naturalWidth,
  naturalHeight,
  editorWidth,
  minSize = MIN_SIZE,
}: ComputeResizedWidthInput): number {
  const dx = pointerX - startPointerX;
  const dy = pointerY - startPointerY;
  let nextWidth = startWidth;
  let nextHeight = startHeight;

  if (handle.includes("e")) {
    nextWidth = startWidth + dx;
  } else if (handle.includes("w")) {
    nextWidth = startWidth - dx;
  }
  if (handle.includes("s")) {
    nextHeight = startHeight + dy;
  } else if (handle.includes("n")) {
    nextHeight = startHeight - dy;
  }

  if (handle === "e" || handle === "w") {
    nextHeight = nextWidth * (naturalHeight / naturalWidth);
  } else if (handle === "n" || handle === "s") {
    nextWidth = nextHeight * (naturalWidth / naturalHeight);
  } else if (startWidth > 0 && startHeight > 0) {
    const scaleX = nextWidth / startWidth;
    const scaleY = nextHeight / startHeight;
    const scale = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY;
    nextWidth = startWidth * scale;
  }

  const originWidth = Math.min(naturalWidth, editorWidth);
  return computeImageDisplaySize({
    naturalWidth,
    naturalHeight,
    editorWidth,
    ratio: originWidth > 0 ? nextWidth / originWidth : 1,
    minSize,
  }).width;
}

function editorWidthOf(block: Element): number {
  const rect = block.getBoundingClientRect();
  return rect.width || (block as HTMLElement).clientWidth || (block as HTMLElement).offsetWidth;
}

function imageBlockAt(view: EditorView, block: Element) {
  try {
    const pos = view.posAtDOM(block, 0);
    for (const candidate of [pos, pos - 1]) {
      if (candidate < 0) {
        continue;
      }
      const node = view.state.doc.nodeAt(candidate);
      if (node?.type.name === IMAGE_BLOCK) {
        return { pos: candidate, node };
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function applyImageSize(view: EditorView, wrapper: HTMLElement, img: HTMLImageElement) {
  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return;
  }
  const block = wrapper.closest(".milkdown-image-block");
  if (!block) {
    return;
  }
  const editorWidth = editorWidthOf(block);
  if (editorWidth <= 0) {
    return;
  }
  const found = imageBlockAt(view, block);
  const ratio = Number(found?.node.attrs.ratio ?? 1);
  const { width } = computeImageDisplaySize({
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    editorWidth,
    ratio,
  });
  if (width <= 0) {
    return;
  }
  img.style.width = `${width}px`;
}

function persistRatio(view: EditorView, block: Element, img: HTMLImageElement, width: number) {
  const found = imageBlockAt(view, block);
  if (!found || !view.editable) {
    return;
  }
  const editorWidth = editorWidthOf(block);
  const { originWidth } = computeImageDisplaySize({
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    editorWidth,
    ratio: 1,
  });
  if (originWidth <= 0) {
    return;
  }
  const ratio = Number.parseFloat((width / originWidth).toFixed(2));
  if (!Number.isFinite(ratio) || ratio === found.node.attrs.ratio) {
    return;
  }
  view.dispatch(view.state.tr.setNodeAttribute(found.pos, "ratio", ratio));
}

function startResize(
  view: EditorView,
  wrapper: HTMLElement,
  handle: ImageResizeHandle,
  event: PointerEvent,
  onDragging: (active: boolean) => void,
) {
  const img = wrapper.querySelector("img");
  if (!img) {
    return;
  }
  const block = wrapper.closest(".milkdown-image-block");
  if (!block || !view.editable) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  onDragging(true);

  const startWidth = img.getBoundingClientRect().width || img.offsetWidth;
  const startHeight = img.getBoundingClientRect().height || img.offsetHeight;
  const startPointerX = event.clientX;
  const startPointerY = event.clientY;
  let lastWidth = startWidth;

  const onMove = (moveEvent: PointerEvent) => {
    moveEvent.preventDefault();
    const width = computeResizedWidth({
      handle,
      startWidth,
      startHeight,
      startPointerX,
      startPointerY,
      pointerX: moveEvent.clientX,
      pointerY: moveEvent.clientY,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      editorWidth: editorWidthOf(block),
    });
    if (width <= 0) {
      return;
    }
    lastWidth = width;
    img.style.width = `${width}px`;
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    persistRatio(view, block, img, lastWidth);
    onDragging(false);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function ensureGrips(view: EditorView, wrapper: HTMLElement, onDragging: (active: boolean) => void) {
  const existing = wrapper.querySelectorAll(`.${IMAGE_RESIZE_GRIP_CLASS}`);
  if (existing.length === IMAGE_RESIZE_HANDLES.length) {
    return;
  }
  for (const node of existing) {
    node.remove();
  }
  for (const handle of IMAGE_RESIZE_HANDLES) {
    const grip = document.createElement("div");
    grip.className = IMAGE_RESIZE_GRIP_CLASS;
    grip.dataset.resize = handle;
    grip.addEventListener("pointerdown", (event) => {
      startResize(view, wrapper, handle, event, onDragging);
    });
    wrapper.append(grip);
  }
}

function bindImage(view: EditorView, img: HTMLImageElement, wrapper: HTMLElement, bound: WeakSet<HTMLImageElement>) {
  if (bound.has(img)) {
    return;
  }
  bound.add(img);
  const apply = () => applyImageSize(view, wrapper, img);
  img.addEventListener("load", apply);
  if (img.complete) {
    apply();
  }
}

function isResizeGrip(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(`.${IMAGE_RESIZE_GRIP_CLASS}`));
}

/** Overlay 8 proportional resize grips on Crepe's block images. */
export function createImageResizePlugin() {
  return $prose(
    () =>
      new Plugin({
        props: {
          handleDOMEvents: {
            pointerdown: (_view, event) => isResizeGrip(event.target),
          },
        },
        view: (editorView) => {
          const boundImgs = new WeakSet<HTMLImageElement>();
          let dragging = false;
          const setDragging = (active: boolean) => {
            dragging = active;
          };

          const sync = () => {
            if (dragging) {
              return;
            }
            const wrappers = editorView.dom.querySelectorAll<HTMLElement>(".milkdown-image-block .image-wrapper");
            for (const wrapper of wrappers) {
              const img = wrapper.querySelector("img");
              if (!img) {
                continue;
              }
              bindImage(editorView, img, wrapper, boundImgs);
              if (editorView.editable) {
                ensureGrips(editorView, wrapper, setDragging);
              } else {
                for (const grip of wrapper.querySelectorAll(`.${IMAGE_RESIZE_GRIP_CLASS}`)) {
                  grip.remove();
                }
              }
              applyImageSize(editorView, wrapper, img);
            }
          };

          const observer = new MutationObserver(sync);
          observer.observe(editorView.dom, { childList: true, subtree: true });
          sync();

          return {
            update: sync,
            destroy: () => {
              observer.disconnect();
            },
          };
        },
      }),
  );
}
