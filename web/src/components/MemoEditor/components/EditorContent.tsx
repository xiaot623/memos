import { forwardRef } from "react";
import Editor from "../Editor";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorContentProps } from "../types";
import type { EditorController } from "../types/editorController";
import WysiwygEditor from "../Wysiwyg";

/**
 * Hosts the active editor (WYSIWYG by default, CodeMirror in raw mode) behind
 * the EditorController contract.
 */
export const EditorContent = forwardRef<EditorController, EditorContentProps>(({ placeholder, onSubmit, onFiles }, ref) => {
  const { actions, dispatch } = useEditorContext();
  const content = useEditorSelector((s) => s.content);
  const contentSource = useEditorSelector((s) => s.contentSource);
  const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
  const isRawMode = useEditorSelector((s) => s.ui.isRawMode);

  const handleContentChange = (next: string) => {
    dispatch(actions.updateContent(next));
  };

  const handleExternalContentApplied = (next: string) => {
    dispatch(actions.setContent(next));
  };

  const handleWysiwygFiles = (files: File[]) => {
    onFiles(files, { source: "paste" });
  };

  if (isRawMode) {
    return (
      <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
        <Editor
          ref={ref}
          className="memo-editor-content"
          initialContent={content}
          contentIsExternal={contentSource === "external"}
          placeholder={placeholder || ""}
          isFocusMode={isFocusMode}
          onContentChange={handleContentChange}
          onExternalContentApplied={handleExternalContentApplied}
          onFiles={onFiles}
          onSubmit={onSubmit}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
      <WysiwygEditor
        ref={ref}
        className="memo-editor-content"
        initialContent={content}
        placeholder={placeholder || ""}
        isFocusMode={isFocusMode}
        onContentChange={handleContentChange}
        onFiles={handleWysiwygFiles}
        onSubmit={onSubmit}
      />
    </div>
  );
});

EditorContent.displayName = "EditorContent";
