import { forwardRef } from "react";
import Editor from "../Editor";
import { useBlobUrls } from "../hooks";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorContentProps } from "../types";
import type { LocalFile } from "../types/attachment";
import type { EditorController } from "../types/editorController";
import WysiwygEditor from "../Wysiwyg";

/**
 * Hosts the active editor (WYSIWYG by default, CodeMirror in raw mode) behind
 * the EditorController contract.
 */
export const EditorContent = forwardRef<EditorController, EditorContentProps>(({ placeholder, onSubmit }, ref) => {
  const { actions, dispatch } = useEditorContext();
  const { createBlobUrl } = useBlobUrls();
  const content = useEditorSelector((s) => s.content);
  const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
  const isRawMode = useEditorSelector((s) => s.ui.isRawMode);

  const handleFiles = (files: File[]) => {
    const localFiles: LocalFile[] = files.map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
      origin: "upload",
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
  };

  const handleContentChange = (next: string) => {
    dispatch(actions.updateContent(next));
  };

  const EditorImpl = isRawMode ? Editor : WysiwygEditor;

  return (
    <div className="w-full min-w-0 flex flex-col flex-1">
      <EditorImpl
        ref={ref}
        className="memo-editor-content"
        initialContent={content}
        placeholder={placeholder || ""}
        isFocusMode={isFocusMode}
        onContentChange={handleContentChange}
        onFiles={handleFiles}
        onSubmit={onSubmit}
      />
    </div>
  );
});

EditorContent.displayName = "EditorContent";
