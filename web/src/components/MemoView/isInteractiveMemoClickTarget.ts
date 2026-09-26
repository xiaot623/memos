const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "label",
  "img",
  "[role='button']",
  "[role='checkbox']",
  "[role='menuitem']",
  "[role='link']",
  "[data-slot='checkbox']",
  "[data-slot='memo-header-actions']",
  "[data-slot='memo-goto-detail']",
  "[data-tag]",
].join(",");

/** True when a card click should keep its native control (tag, link, image, menu, …). */
export function isInteractiveMemoClickTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return Boolean(element?.closest(INTERACTIVE_SELECTOR));
}

/**
 * True when the click landed on the card itself. Portaled descendants (the move dialog,
 * its space list) still bubble through React, but their DOM nodes are outside the card.
 */
export function isMemoCardSurfaceClick(event: { currentTarget: EventTarget | null; target: EventTarget | null }): boolean {
  if (!(event.currentTarget instanceof Node) || !(event.target instanceof Node) || !event.currentTarget.contains(event.target)) {
    return false;
  }
  return !isInteractiveMemoClickTarget(event.target);
}
