import { Maximize2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { needsRawMarkdown } from "@/components/MarkdownRuntime/unsupportedSyntax";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalStorage } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";
import { EditorContent, EditorMetadata, FocusModeOverlay, PeekEditorDialog, TimestampPopover } from "./components";
import { FOCUS_MODE_STYLES, FORMATTING_TOOLBAR_STORAGE_KEY, PEEK_MODE_STYLES } from "./constants";
import type { EditorFileOrigin } from "./Editor/extensions";
import {
  splitInlineLocalFiles,
  toLocalFiles,
  useAutoSave,
  useBlobUrls,
  useFocusMode,
  useInlineImageUpload,
  useMemoInit,
  useMemoSave,
} from "./hooks";
import { cacheService } from "./services";
import { EditorProvider, useEditorContext, useEditorSelector } from "./state";
import { EditorToolbar, FormattingToolbar } from "./Toolbar";
import type { EditorViewToggles, MemoEditorProps } from "./types";
import type { EditorController } from "./types/editorController";

// A host that presents the editor full-screen supplies `onFocusModeExit`; its
// presence is what makes an instance hosted, so focus mode starts on and stays on.
const MemoEditor = (props: MemoEditorProps) => (
  <EditorProvider initialFocusMode={Boolean(props.onFocusModeExit)}>
    <MemoEditorImpl {...props} />
  </EditorProvider>
);

const MemoEditorImpl: React.FC<MemoEditorProps> = ({
  className,
  cacheKey,
  memo,
  defaultSpace,
  autoFocus,
  onFocusModeExit,
  onFocusModeChange,
  placeholder,
  defaultCreateTime,
  onConfirm,
  onCancel,
  onSavingChange,
  presentation = "inline",
}) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const editorRef = useRef<EditorController>(null);
  const { actions, dispatch, getState } = useEditorContext();
  // Subscribe only to the low-frequency slices this component renders from, so
  // typing (which changes content) does not re-render the editor shell and its
  // toolbar/metadata children.
  const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
  const isRawMode = useEditorSelector((s) => s.ui.isRawMode);
  const isSaving = useEditorSelector((s) => s.ui.isLoading.saving);
  // Report focus-mode changes so a host can react; inline hosts pass nothing.
  useEffect(() => {
    onFocusModeChange?.(isFocusMode);
  }, [isFocusMode, onFocusModeChange]);
  const hasTimestamp = useEditorSelector((s) => Boolean(s.timestamps.createTime));
  const { userGeneralSetting } = useAuth();
  const { createBlobUrl } = useBlobUrls();
  const saveMediaMetadata = userGeneralSetting?.saveMediaMetadata ?? false;
  const inlineImageUpload = useInlineImageUpload(editorRef);
  // Persisted preference: also show the formatting toolbar in normal mode. Focus
  // mode always shows it regardless; this only governs the non-focus layout.
  const [isFormattingToolbarVisible, setFormattingToolbarVisible] = useLocalStorage(FORMATTING_TOOLBAR_STORAGE_KEY, false);

  const memoName = memo?.name;
  const isPeek = presentation === "peek";
  // Existing resources own their placement. New replies are not placed
  // independently; only a new top-level memo inherits its host's target.
  const editorSpace = memo?.space ?? defaultSpace;

  // No visibility picker: new memos inherit their audience from placement —
  // SPACE when composing inside a Space, otherwise the user's default (PRIVATE).
  // Edits keep their existing visibility via fromMemo and ignore this.
  const settingVisibility = userGeneralSetting?.memoVisibility ? convertVisibilityFromString(userGeneralSetting.memoVisibility) : undefined;
  const defaultVisibility = memo ? settingVisibility : editorSpace ? Visibility.SPACE : settingVisibility;
  const editorCacheKey = cacheService.key(currentUser?.name ?? "", cacheKey);

  const { isInitialized } = useMemoInit({
    editorRef,
    memo,
    cacheKey,
    username: currentUser?.name ?? "",
    autoFocus,
    defaultVisibility,
    defaultCreateTime,
  });
  const isDraftCacheEnabled = !memo;

  useEffect(() => {
    if (!isInitialized) {
      return;
    }
    if (!needsRawMarkdown(getState().content)) {
      return;
    }
    dispatch(actions.setRawMode(true));
    toast(t("editor.unsupported-syntax-raw-mode"));
  }, [isInitialized, actions, dispatch, getState, t]);

  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  // Auto-save content to localStorage (subscribes to the store internally).
  const { discard: discardDraft } = useAutoSave(currentUser?.name ?? "", cacheKey, isInitialized && isDraftCacheEnabled);

  const { containerRef: editorContainerRef, placeholderHeight } = useFocusMode(isFocusMode && !isPeek);

  // Live-sync the draft's createTime/updateTime to the calendar-derived prop.
  // Only applies in create mode; edit mode owns its own timestamps. Runs after
  // initial mount (the seed value is set in useMemoInit), and again whenever
  // the prop changes — e.g., when the user picks a different calendar date
  // while the editor is open.
  useEffect(() => {
    if (memo) return;
    if (!isInitialized) return;
    dispatch(
      actions.setTimestamps({
        createTime: defaultCreateTime,
        updateTime: defaultCreateTime,
      }),
    );
  }, [defaultCreateTime, memo, isInitialized, actions, dispatch]);

  const rememberCursor = useCallback(() => {
    const cursor = editorRef.current?.getCursor();
    if (cursor !== undefined) {
      cacheService.saveCursor(editorCacheKey, cursor);
    }
  }, [editorCacheKey]);

  // Hosted: focus mode is the host's frame, so leaving it dismisses the host.
  // Inline: focus mode is a view this editor owns and toggles in place.
  const handleToggleFocusMode = () => {
    if (onFocusModeExit) {
      rememberCursor();
      onFocusModeExit();
      return;
    }
    dispatch(actions.toggleFocusMode());
  };

  const handleCancel = useCallback(() => {
    rememberCursor();
    onCancel?.();
  }, [onCancel, rememberCursor]);

  const handleToggleFormattingToolbar = useCallback(() => {
    setFormattingToolbarVisible((visible) => !visible);
  }, [setFormattingToolbarVisible]);

  const handleToggleRawMode = useCallback(() => {
    dispatch(actions.setRawMode(!isRawMode));
  }, [actions, dispatch, isRawMode]);

  /**
   * Single ingest point for files the editor receives. Inline placement writes
   * images into the text (at `position`, else the caret) and attaches the rest;
   * otherwise everything joins the attachment list.
   */
  const handleFiles = useCallback(
    (files: File[], placement: { inline: false } | { inline: true; position?: number }) => {
      if (getState().ui.isLoading.saving) return;
      const localFiles = toLocalFiles(files, { createBlobUrl, saveMediaMetadata });
      const { inline, attachments } = placement.inline ? splitInlineLocalFiles(localFiles) : { inline: [], attachments: localFiles };
      attachments.forEach((file) => dispatch(actions.addLocalFile(file)));
      if (placement.inline) inlineImageUpload.insertLocalImages(inline, placement.position);
    },
    [actions, createBlobUrl, dispatch, getState, inlineImageUpload.insertLocalImages, saveMediaMetadata],
  );

  /** The ＋ menu's Insert image: inline at the caret. */
  const handleInsertImages = useCallback((files: File[]) => handleFiles(files, { inline: true }), [handleFiles]);

  /**
   * A drop inlines images where they landed. A paste carries no placement
   * gesture, so it attaches like the ＋ menu's upload; the attachment list's
   * own Insert action is how a pasted image becomes inline.
   */
  const handleEditorFiles = useCallback(
    (files: File[], origin: EditorFileOrigin) =>
      handleFiles(files, origin.source === "drop" ? { inline: true, position: origin.position } : { inline: false }),
    [handleFiles],
  );

  // The ＋ menu's view toggles only describe how an inline editor presents
  // itself, so a hosted editor offers neither: its host owns the frame, and
  // focus mode already forces the formatting toolbar on.
  const viewToggles: EditorViewToggles | undefined = onFocusModeExit
    ? undefined
    : {
        onToggleFocusMode: handleToggleFocusMode,
        isFormattingToolbarVisible,
        onToggleFormattingToolbar: handleToggleFormattingToolbar,
      };

  const saveMemo = useMemoSave({
    memoName,
    defaultSpace,
    defaultVisibility,
    defaultCreateTime,
    discardDraft,
    onConfirm,
    onCancel: onCancel ? handleCancel : undefined,
    onSavingChange,
  });
  const [peekOpen, setPeekOpen] = useState(true);
  const peekCanceledRef = useRef(false);

  const closePeek = useCallback((canceled = false) => {
    if (canceled) {
      peekCanceledRef.current = true;
    }
    setPeekOpen(false);
  }, []);

  const handlePeekExited = useCallback(() => {
    if (peekCanceledRef.current) {
      onCancel?.();
      return;
    }
    void saveMemo({ closeIfUnchanged: true, closeImmediately: true });
  }, [onCancel, saveMemo]);

  const handleSave = useCallback(() => {
    if (isPeek) {
      closePeek();
      return;
    }
    void saveMemo();
  }, [closePeek, isPeek, saveMemo]);

  const showTimestamp = Boolean(memoName || (!memo && hasTimestamp));
  const showPeekMaximize = isPeek && !isFocusMode;

  const editorCard = (
    <div
      ref={editorContainerRef}
      className={cn(
        "group relative w-full flex flex-col justify-between items-start bg-card px-4 py-3 rounded-lg border border-border/70 gap-2",
        isPeek && PEEK_MODE_STYLES.container,
        !isPeek && FOCUS_MODE_STYLES.transition,
        !isPeek && isFocusMode && cn(FOCUS_MODE_STYLES.container.base, FOCUS_MODE_STYLES.container.spacing),
        !isPeek && !isFocusMode && className,
      )}
    >
      {(isFocusMode || isFormattingToolbarVisible) && (
        <FormattingToolbar
          controllerRef={editorRef}
          exit={isFocusMode ? { action: onFocusModeExit ? "close" : "minimize", onExit: handleToggleFocusMode } : undefined}
        />
      )}

      {(showTimestamp || showPeekMaximize) && (
        <div className="flex h-6 w-full items-center justify-between gap-2">
          {showTimestamp ? <TimestampPopover /> : <span />}
          {showPeekMaximize && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 opacity-60 hover:opacity-100"
              onClick={handleToggleFocusMode}
              title={t("editor.focus-mode")}
              aria-label={t("editor.focus-mode")}
            >
              <Maximize2Icon className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      <EditorContent ref={editorRef} placeholder={placeholder} onSubmit={handleSave} onFiles={handleEditorFiles} />

      <div className="w-full flex flex-col gap-2">
        <EditorMetadata
          memoName={memoName}
          uploadingLocalFileURLs={inlineImageUpload.uploadingLocalFileURLs}
          onInsertAttachments={inlineImageUpload.insertRemoteImages}
          onInsertLocalFiles={inlineImageUpload.insertLocalImages}
        />
        <EditorToolbar
          onSave={handleSave}
          onCancel={onCancel ? (isPeek ? () => closePeek(true) : handleCancel) : undefined}
          memoName={memoName}
          viewToggles={isPeek ? undefined : viewToggles}
          onInsertImages={handleInsertImages}
          isRawMode={isRawMode}
          onToggleRawMode={handleToggleRawMode}
        />
      </div>
    </div>
  );

  if (isPeek) {
    return (
      <PeekEditorDialog
        open={peekOpen}
        isFocusMode={isFocusMode}
        title={t("common.edit")}
        onOpenChange={(open) => {
          if (!open) closePeek();
        }}
        onDismiss={handlePeekExited}
      >
        {editorCard}
      </PeekEditorDialog>
    );
  }

  return (
    <>
      <FocusModeOverlay isActive={isFocusMode} onToggle={handleToggleFocusMode} />
      {isFocusMode && placeholderHeight > 0 && (
        <div aria-hidden className={cn("w-full", className)} style={{ height: placeholderHeight }} />
      )}
      {editorCard}
    </>
  );
};

export default MemoEditor;
