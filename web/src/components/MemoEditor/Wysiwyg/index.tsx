import type { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createMarkdownRuntime } from "@/components/MarkdownRuntime/createRuntime";
import { hasHiddenHtml } from "@/components/MarkdownRuntime/plugins/html";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getThemeWithFallback } from "@/utils/theme";
import type { EditorController } from "../types/editorController";
import { createWysiwygController } from "./controller";
import { createWysiwygFormattingController } from "./formatting";
import "@/components/MarkdownRuntime/theme.css";

interface WysiwygEditorProps {
  className: string;
  initialContent: string;
  placeholder: string;
  onContentChange: (content: string) => void;
  onFiles: (files: File[]) => void;
  onSubmit: () => void;
  /**
   * Reports the parsed document. Return true once that report is the opening
   * markdown; false asks for another report after the document catches up.
   */
  onOpeningDocument?: (markdown: string, hasHiddenHtml: boolean) => boolean;
  isFocusMode?: boolean;
}

const WysiwygEditorInner = forwardRef(function WysiwygEditorInner(props: WysiwygEditorProps, ref: React.ForwardedRef<EditorController>) {
  const { className, initialContent, placeholder, onContentChange, onFiles, onSubmit, onOpeningDocument, isFocusMode } = props;
  const crepeRef = useRef<Crepe | undefined>(undefined);
  const ctxRef = useRef<Ctx | undefined>(undefined);
  const controllerRef = useRef<EditorController | null>(null);
  const listenersRef = useRef(new Set<() => void>());
  const onChangeRef = useRef(onContentChange);
  onChangeRef.current = onContentChange;
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const initialContentRef = useRef(initialContent);
  const onOpeningDocumentRef = useRef(onOpeningDocument);
  onOpeningDocumentRef.current = onOpeningDocument;
  const openingCheckedRef = useRef(false);
  const { userGeneralSetting } = useAuth();

  const { loading } = useEditor((root) => {
    const crepe = createMarkdownRuntime({
      root,
      defaultValue: initialContentRef.current,
      placeholder,
      mode: "edit",
      onMarkdownUpdated: (markdown) => onChangeRef.current(markdown),
      onFiles: (files) => onFilesRef.current(files),
      onSubmit: () => onSubmitRef.current(),
      getTheme: () => getThemeWithFallback(userGeneralSetting?.theme),
    });
    crepeRef.current = crepe;
    crepe.on((listener) => {
      listener.mounted((ctx) => {
        ctxRef.current = ctx;
        onOpeningDocumentRef.current?.(crepe.getMarkdown(), hasHiddenHtml(ctx.get(editorViewCtx).state.doc));
      });
      listener.updated(() => {
        listenersRef.current.forEach((fn) => fn());
      });
      listener.selectionUpdated(() => {
        listenersRef.current.forEach((fn) => fn());
      });
    });
    controllerRef.current = createWysiwygController(
      () => crepeRef.current,
      createWysiwygFormattingController(() => ctxRef.current, listenersRef.current),
    );
    return crepe;
  }, []);

  useEffect(() => {
    const crepe = crepeRef.current;
    if (!crepe || loading) {
      return;
    }
    // Crepe is created from the first render, which is often empty. Memo text
    // arrives after init, so re-check once that document is in the editor.
    const drifted = crepe.getMarkdown() !== initialContent;
    if (!drifted && openingCheckedRef.current) {
      return;
    }
    crepe.editor.action((ctx) => {
      if (drifted) {
        replaceAll(initialContent)(ctx);
      }
      const accepted = onOpeningDocumentRef.current?.(crepe.getMarkdown(), hasHiddenHtml(ctx.get(editorViewCtx).state.doc)) ?? true;
      if (accepted) {
        openingCheckedRef.current = true;
      }
    });
  }, [initialContent, loading]);

  useImperativeHandle(ref, () => controllerRef.current as EditorController, [loading]);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".ProseMirror, button, a, input, textarea, [contenteditable='true']")) {
      return;
    }
    controllerRef.current?.focus();
  };

  return (
    <div
      className={cn(
        "markdown-runtime relative flex w-full min-w-0 cursor-text flex-col bg-inherit",
        isFocusMode && "min-h-0 flex-1",
        className,
      )}
      data-focus-mode={isFocusMode || undefined}
      onMouseDown={handleMouseDown}
    >
      <div className={cn("w-full min-w-0", isFocusMode && "min-h-0 flex-1")}>
        <Milkdown />
      </div>
    </div>
  );
});

const WysiwygEditor = forwardRef(function WysiwygEditor(props: WysiwygEditorProps, ref: React.ForwardedRef<EditorController>) {
  return (
    <MilkdownProvider>
      <WysiwygEditorInner {...props} ref={ref} />
    </MilkdownProvider>
  );
});

export default WysiwygEditor;
