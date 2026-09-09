import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/utils";
import { PEEK_MODE_STYLES } from "../constants";

interface PeekEditorDialogProps {
  isFocusMode: boolean;
  title: string;
  onDismiss: () => void;
  children: ReactNode;
}

/**
 * Keep-style host for an existing memo: blurred backdrop, compact centered card,
 * Esc/backdrop dismiss. Focus mode only grows the popup; it does not own close.
 * Dismiss is never blocked — the editor saves in the background after close.
 */
export function PeekEditorDialog({ isFocusMode, title, onDismiss, children }: PeekEditorDialogProps) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open, eventDetails) => {
        if (open) return;
        eventDetails.cancel();
        onDismiss();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={PEEK_MODE_STYLES.backdrop} />
        <DialogPrimitive.Popup
          data-slot="memo-peek-editor"
          className={cn("z-overlay outline-none", isFocusMode ? PEEK_MODE_STYLES.focusPopup : PEEK_MODE_STYLES.popup)}
          initialFocus
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            onDismiss();
          }}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          </VisuallyHidden>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
