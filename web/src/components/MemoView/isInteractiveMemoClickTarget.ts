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
