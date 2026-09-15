import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Crepe } from "@milkdown/crepe";
import { editorViewOptionsCtx } from "@milkdown/kit/core";
import { createMermaidPreviewRenderer } from "./mermaidPreview";
import { configureFootnoteDom } from "./plugins/footnotes";
import { createFileHandlerPlugin, createSubmitKeymap } from "./plugins/handlers";
import { createHeadingIdPlugin } from "./plugins/headingIds";
import { configureTrustedHtml } from "./plugins/html";
import { createImageResizePlugin } from "./plugins/imageResize";
import { createLinkCardPlugin } from "./plugins/linkCard";
import { tagMentionPlugins } from "./plugins/tagMention";

export type MarkdownRuntimeMode = "edit" | "view";

export interface CreateMarkdownRuntimeOptions {
  root: HTMLElement;
  defaultValue?: string;
  placeholder?: string;
  mode: MarkdownRuntimeMode;
  onMarkdownUpdated?: (markdown: string) => void;
  onFiles?: (files: File[]) => void;
  onSubmit?: () => void;
  getTheme?: () => string;
}

export function createMarkdownRuntime({
  root,
  defaultValue = "",
  placeholder = "",
  mode,
  onMarkdownUpdated,
  onFiles,
  onSubmit,
  getTheme = () => "default",
}: CreateMarkdownRuntimeOptions): Crepe {
  const readonly = mode === "view";
  const crepe = new Crepe({
    root,
    defaultValue,
    features: {
      [Crepe.Feature.Toolbar]: false,
      [Crepe.Feature.TopBar]: false,
      [Crepe.Feature.AI]: false,
      [Crepe.Feature.Placeholder]: !readonly,
      [Crepe.Feature.BlockEdit]: false,
      [Crepe.Feature.Cursor]: !readonly,
      [Crepe.Feature.LinkTooltip]: !readonly,
      [Crepe.Feature.ImageBlock]: true,
      [Crepe.Feature.ListItem]: true,
      [Crepe.Feature.CodeMirror]: true,
      [Crepe.Feature.Table]: true,
      [Crepe.Feature.Latex]: true,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        text: placeholder,
        mode: "doc",
      },
      [Crepe.Feature.CodeMirror]: {
        renderPreview: createMermaidPreviewRenderer(getTheme),
        previewOnlyByDefault: readonly,
        // Milkdown only marks CodeMirror readOnly, which still leaves a focused
        // editor caret. View mode must not be an editor at all.
        extensions: readonly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [],
      },
    },
  });

  if (readonly) {
    crepe.setReadonly(true);
    crepe.on((listener) => {
      listener.mounted(() => {
        crepe.setReadonly(true);
      });
    });
  }

  crepe.editor.config((ctx) => {
    configureTrustedHtml(ctx);
    configureFootnoteDom(ctx);
    if (readonly) {
      ctx.update(editorViewOptionsCtx, (prev) => ({
        ...prev,
        attributes: {
          ...(typeof prev.attributes === "object" && prev.attributes ? prev.attributes : {}),
          tabindex: "-1",
        },
      }));
    }
  });

  for (const plugin of tagMentionPlugins) {
    crepe.editor.use(plugin);
  }
  crepe.editor.use(createHeadingIdPlugin());
  crepe.editor.use(createImageResizePlugin());
  if (readonly) {
    crepe.editor.use(createLinkCardPlugin());
  }
  if (onSubmit) {
    crepe.editor.use(createSubmitKeymap(onSubmit));
  }
  if (onFiles) {
    crepe.editor.use(createFileHandlerPlugin(onFiles));
  }

  if (onMarkdownUpdated) {
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onMarkdownUpdated(markdown);
      });
    });
  }

  return crepe;
}
