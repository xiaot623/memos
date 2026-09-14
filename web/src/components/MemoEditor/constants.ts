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
export const PEEK_MORPH_MS = 420;
export const PEEK_PRESENCE_MS = 280;
export const PEEK_MORPH_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

export const PEEK_MODE_STYLES = {
  backdrop:
    "fixed inset-0 z-overlay bg-black/20 backdrop-blur-sm transition-opacity duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none data-starting-style:opacity-0 data-ending-style:opacity-0",
  popup:
    "fixed top-1/2 left-1/2 z-overlay origin-center -translate-x-1/2 -translate-y-1/2 outline-none transition-[opacity,scale] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.96] data-ending-style:opacity-0",
  shell: "flex min-h-0 w-[calc(100vw-2rem)] flex-col md:w-[calc(100vw-4rem)]",
  compactShell: "max-h-[85vh] max-w-lg",
  focusShell: "h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] max-w-5xl md:h-[calc(100vh-4rem)] md:max-h-[calc(100vh-4rem)]",
  container: "min-h-0 flex-1 overflow-y-auto shadow-2xl",
} as const;

// localStorage key for the user's preference to show the formatting toolbar in
// normal (non-focus) mode. Defaults to off.
export const FORMATTING_TOOLBAR_STORAGE_KEY = "memos-editor-formatting-toolbar";
