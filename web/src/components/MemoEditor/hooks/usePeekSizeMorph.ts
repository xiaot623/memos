import { useLayoutEffect, useRef } from "react";
import { PEEK_MORPH_EASING, PEEK_MORPH_MS } from "../constants";

interface Size {
  width: number;
  height: number;
}

interface PeekMorphMotion {
  cancel: () => void;
}

function readSize(el: HTMLElement): Size {
  return { width: el.offsetWidth, height: el.offsetHeight };
}

function prefersReducedMotion(): boolean {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function clearInlineSize(el: HTMLElement) {
  el.style.width = "";
  el.style.height = "";
  el.style.maxWidth = "";
  el.style.maxHeight = "";
  el.style.transition = "";
}

function applyInlineSize(el: HTMLElement, size: Size, transition: string) {
  el.style.maxWidth = "none";
  el.style.maxHeight = "none";
  el.style.width = `${size.width}px`;
  el.style.height = `${size.height}px`;
  el.style.transition = transition;
}

function playSizeMorph(el: HTMLElement, from: Size, to: Size): PeekMorphMotion {
  let settled = false;
  let timeoutId = 0;

  const settle = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeoutId);
    clearInlineSize(el);
  };

  applyInlineSize(el, from, "none");
  void el.offsetWidth;
  applyInlineSize(el, to, `width ${PEEK_MORPH_MS}ms ${PEEK_MORPH_EASING}, height ${PEEK_MORPH_MS}ms ${PEEK_MORPH_EASING}`);
  timeoutId = window.setTimeout(settle, PEEK_MORPH_MS);

  return {
    cancel: () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      clearInlineSize(el);
    },
  };
}

/**
 * Morphs the peek editor shell between compact and expanded sizes.
 *
 * Compact and expanded layouts share one overlay, but compact height is
 * content-driven (`auto`) while expanded height fills the padded frame. CSS
 * cannot interpolate `auto` → a pixel height, so this hook snapshots the
 * previous box during render (DOM still has the old layout) and then tweens
 * explicit width/height after the new layout commits.
 */
export function usePeekSizeMorph(isExpanded: boolean) {
  const shellRef = useRef<HTMLDivElement>(null);
  const prevExpandedRef = useRef(isExpanded);
  const fromSizeRef = useRef<Size | null>(null);
  const motionRef = useRef<PeekMorphMotion | null>(null);

  if (prevExpandedRef.current !== isExpanded) {
    const el = shellRef.current;
    if (el) {
      fromSizeRef.current = readSize(el);
    }
    prevExpandedRef.current = isExpanded;
  }

  useLayoutEffect(() => {
    const el = shellRef.current;
    const from = fromSizeRef.current;
    if (!el || !from) return;

    motionRef.current?.cancel();
    motionRef.current = null;

    if (prefersReducedMotion()) {
      clearInlineSize(el);
      return;
    }

    const to = readSize(el);
    if (from.width === 0 || from.height === 0 || to.width === 0 || to.height === 0) {
      return;
    }
    if (from.width === to.width && from.height === to.height) {
      return;
    }

    motionRef.current = playSizeMorph(el, from, to);
    return () => {
      motionRef.current?.cancel();
      motionRef.current = null;
    };
  }, [isExpanded]);

  return shellRef;
}
