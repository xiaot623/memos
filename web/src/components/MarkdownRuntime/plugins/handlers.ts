import { keymap } from "@milkdown/kit/prose/keymap";
import { Plugin } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

function clipboardFiles(event: ClipboardEvent): File[] {
  const clipboard = event.clipboardData;
  if (!clipboard) {
    return [];
  }

  const itemFiles = Array.from(clipboard.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return itemFiles.length > 0 ? itemFiles : Array.from(clipboard.files);
}

export function createSubmitKeymap(onSubmit: () => void) {
  const run = () => {
    onSubmit();
    return true;
  };
  return $prose(() =>
    keymap({
      "Mod-Enter": run,
    }),
  );
}

export function createFileHandlerPlugin(onFiles: (files: File[]) => void) {
  return $prose(
    () =>
      new Plugin({
        props: {
          handleDOMEvents: {
            paste: (_view, event) => {
              const files = clipboardFiles(event);
              if (files.length === 0) {
                return false;
              }
              event.preventDefault();
              onFiles(files);
              return true;
            },
            drop: (_view, event) => {
              const files = Array.from(event.dataTransfer?.files ?? []);
              if (files.length === 0) {
                return false;
              }
              event.preventDefault();
              onFiles(files);
              return true;
            },
          },
        },
      }),
  );
}
