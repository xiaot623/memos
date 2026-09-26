interface DialogCallback {
  destroy: (...args: unknown[]) => unknown;
}

type DialogProps = DialogCallback;
