/**
 * Tag pill color for Milkdown tag atoms. Shape, padding, and typography live
 * in `theme.css` (`span[data-tag]`), so only the theme color stays here.
 */
export const tagStyles = {
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
