export const FOCUS_MODE_STYLES = {
  backdrop: "fixed inset-0 bg-black/20 backdrop-blur-sm z-40",
  container: {
    base: "fixed z-50 w-auto max-w-5xl mx-auto shadow-2xl border-border h-auto overflow-y-auto",
    spacing: "top-2 left-2 right-2 bottom-2 sm:top-4 sm:left-4 sm:right-4 sm:bottom-4 md:top-8 md:left-8 md:right-8 md:bottom-8",
  },
  transition: "transition-all duration-300 ease-in-out",
  exitButton: "absolute top-2 right-2 z-10 opacity-60 hover:opacity-100",
} as const;

/** Keep-style peek overlay: compact centered card over a blurred list. */
export const PEEK_MODE_STYLES = {
  backdrop: "fixed inset-0 z-overlay bg-black/20 backdrop-blur-sm",
  popup: "fixed left-1/2 top-1/2 z-overlay w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
  focusPopup: "fixed inset-0 z-overlay flex flex-col p-2 sm:p-4 md:p-8",
  container: "max-h-[85vh] overflow-y-auto shadow-2xl",
  focusContainer: "flex-1 min-h-0 max-w-5xl mx-auto overflow-y-auto shadow-2xl",
} as const;

// localStorage key for the user's preference to show the formatting toolbar in
// normal (non-focus) mode. Defaults to off.
export const FORMATTING_TOOLBAR_STORAGE_KEY = "memos-editor-formatting-toolbar";
