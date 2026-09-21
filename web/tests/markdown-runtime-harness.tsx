import type { MarkdownRuntimeMode } from "@/components/MarkdownRuntime/createRuntime";
import { createMarkdownRuntime } from "@/components/MarkdownRuntime/createRuntime";

export async function mountRuntime(
  markdown: string,
  mode: MarkdownRuntimeMode = "view",
  placeholder = "",
  onFiles?: (files: File[]) => void,
) {
  const root = document.createElement("div");
  root.dataset.memoContent = "";
  document.body.append(root);
  const crepe = createMarkdownRuntime({
    root,
    defaultValue: markdown,
    mode,
    placeholder,
    onFiles,
  });
  await crepe.create();
  return {
    root,
    crepe,
    cleanup: async () => {
      await crepe.destroy();
      root.remove();
    },
  };
}
