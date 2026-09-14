import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/utils";
import { PEEK_MODE_STYLES } from "../constants";
import { usePeekSizeMorph } from "../hooks/usePeekSizeMorph";

interface PeekEditorDialogProps {
  isFocusMode: boolean;
  title: string;
  onDismiss: () => void;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Keep-style host for an existing memo: blurred backdrop, compact centered card,
 * Esc/backdrop dismiss. Presence uses the same center-origin easing as the
 * compact↔focus morph so enter, expand, and exit feel like one motion. Focus
 * mode does not own close. Dismiss is never blocked — the editor saves in the
 * background after the exit animation.
 */
export function PeekEditorDialog({ isFocusMode, title, onDismiss, children, open: openProp, onOpenChange }: PeekEditorDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(true);
  const dismissedRef = useRef(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const shellRef = usePeekSizeMorph(isFocusMode);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return;
      onOpenChange?.(false);
      if (!isControlled) {
        setUncontrolledOpen(false);
      }
    },
    [isControlled, onOpenChange],
  );

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen || dismissedRef.current) return;
        dismissedRef.current = true;
        onDismiss();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop data-slot="memo-peek-backdrop" className={PEEK_MODE_STYLES.backdrop} />
        <DialogPrimitive.Popup data-slot="memo-peek-editor" className={cn("z-overlay outline-none", PEEK_MODE_STYLES.popup)} initialFocus>
          <VisuallyHidden>
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          </VisuallyHidden>
          <div
            ref={shellRef}
            data-slot="memo-peek-shell"
            data-state={isFocusMode ? "expanded" : "compact"}
            className={cn(PEEK_MODE_STYLES.shell, isFocusMode ? PEEK_MODE_STYLES.focusShell : PEEK_MODE_STYLES.compactShell)}
          >
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
