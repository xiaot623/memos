/**
 * Tag pill styling for Milkdown tag marks. Split into two tokens so the view
 * can swap `defaultColor` for an inline custom color.
 */
export const tagStyles = {
  /** Shape, padding, and typography — always applied. */
  base: "inline-flex items-center align-baseline px-1.5 py-0.5 text-[0.9em] leading-none font-normal rounded-full border",
  /** Default theme color, used when no custom tag color is set. */
  defaultColor: "border-primary text-primary bg-primary/15",
} as const;

/**
 * `@mention` styling for Milkdown mention marks. Unlike a tag this is not a
 * pill — it is a primary-colored accent.
 */
export const mentionStyles = {
  base: "text-primary underline-offset-2",
} as const;
