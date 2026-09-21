import { Maximize2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { needsRawMarkdown } from "@/components/MarkdownRuntime/unsupportedSyntax";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { useLocalStorage } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";
import { AudioRecorderPanel, EditorContent, EditorMetadata, FocusModeOverlay, PeekEditorDialog, TimestampPopover } from "./components";
import { FOCUS_MODE_STYLES, FORMATTING_TOOLBAR_STORAGE_KEY, PEEK_MODE_STYLES } from "./constants";
import type { EditorFileOrigin } from "./Editor/extensions";
import {
  splitInlineLocalFiles,
  toLocalFiles,
  useAudioRecorder,
  useAutoSave,
  useBlobUrls,
  useFocusMode,
  useInlineImageUpload,
  useMemoInit,
  useMemoSave,
} from "./hooks";
import { cacheService, errorService, transcriptionService } from "./services";
import { EditorProvider, useEditorContext, useEditorSelector } from "./state";
import { EditorToolbar, FormattingToolbar } from "./Toolbar";
import type { EditorViewToggles, MemoEditorProps } from "./types";
import type { LocalFile } from "./types/attachment";
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
  parentMemoName,
  defaultSpace,
  defaultLocation,
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
  const { aiSetting, fetchSetting } = useInstance();
  const [isAudioRecorderOpen, setIsAudioRecorderOpen] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
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
  const editorSpace = memo ? memo.space : parentMemoName ? undefined : defaultSpace;
  const canTranscribe = useMemo(() => {
    const providerId = aiSetting.transcription?.providerId ?? "";
    if (!providerId) return false;
    const provider = aiSetting.providers.find((p) => p.id === providerId);
    return Boolean(provider?.apiKeySet);
  }, [aiSetting.providers, aiSetting.transcription?.providerId]);

  // Get default visibility from user settings
  const defaultVisibility = userGeneralSetting?.memoVisibility ? convertVisibilityFromString(userGeneralSetting.memoVisibility) : undefined;
  const editorCacheKey = cacheService.key(currentUser?.name ?? "", cacheKey);

  const { isInitialized } = useMemoInit({
    editorRef,
    memo,
    cacheKey,
    username: currentUser?.name ?? "",
    autoFocus,
    defaultVisibility,
    defaultCreateTime,
    defaultLocation,
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
  const { discardDraft } = useAutoSave(currentUser?.name ?? "", cacheKey, isInitialized && isDraftCacheEnabled);

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

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void fetchSetting(InstanceSetting_Key.AI).catch(() => undefined);
  }, [currentUser, fetchSetting]);

  const insertTranscribedText = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.insertMarkdown(text);
    editor.scrollToCursor();
  }, []);

  const handleTranscribeRecordedAudio = useCallback(
    async (localFile: LocalFile) => {
      if (!canTranscribe) {
        dispatch(actions.addLocalFile(localFile));
        setIsTranscribingAudio(false);
        setIsAudioRecorderOpen(false);
        return;
      }

      try {
        const text = (await transcriptionService.transcribeFile(localFile.file)).trim();
        if (!text) {
          dispatch(actions.addLocalFile(localFile));
          toast.error(t("editor.audio-recorder.transcribe-empty"));
          return;
        }

        insertTranscribedText(text);
        toast.success(t("editor.audio-recorder.transcribe-success"));
      } catch (error) {
        console.error(error);
        toast.error(errorService.getErrorMessage(error) || t("editor.audio-recorder.transcribe-error"));
        dispatch(actions.addLocalFile(localFile));
      } finally {
        setIsTranscribingAudio(false);
        setIsAudioRecorderOpen(false);
      }
    },
    [actions, canTranscribe, dispatch, insertTranscribedText, t],
  );

  const audioRecorder = useAudioRecorder({
    onRecordingComplete: (localFile, mode) => {
      if (mode === "transcribe") {
        void handleTranscribeRecordedAudio(localFile);
        return;
      }

      dispatch(actions.addLocalFile(localFile));
      setIsAudioRecorderOpen(false);
    },
    onRecordingEmpty: (mode) => {
      if (mode === "transcribe") {
        setIsTranscribingAudio(false);
        toast.error(t("editor.audio-recorder.transcribe-empty"));
      }
      setIsAudioRecorderOpen(false);
    },
  });

  // Mirror the recorder's busy state into the store so validationService.canSave
  // (consumed here and by EditorToolbar) can block saves mid-recording without
  // the reducer owning the recorder's full state.
  useEffect(() => {
    dispatch(actions.setRecorderBusy(audioRecorder.isBusy));
  }, [audioRecorder.isBusy, actions, dispatch]);

  useEffect(() => {
    if (!isAudioRecorderOpen) {
      return;
    }

    if (audioRecorder.status === "error" || audioRecorder.status === "unsupported") {
      toast.error(audioRecorder.error || t("editor.audio-recorder.error-description"));
      setIsAudioRecorderOpen(false);
    }
  }, [isAudioRecorderOpen, audioRecorder.error, audioRecorder.status, t]);

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

  const handleStartAudioRecording = async () => {
    setIsAudioRecorderOpen(true);
    await audioRecorder.startRecording();
  };

  const handleAudioRecorderClick = () => {
    if (audioRecorder.isBusy) {
      return;
    }

    void handleStartAudioRecording();
  };

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

  const handleCancelAudioRecording = () => {
    setIsTranscribingAudio(false);
    audioRecorder.resetRecording();
    setIsAudioRecorderOpen(false);
  };

  const handleTranscribeAudioRecording = () => {
    if (!canTranscribe || isTranscribingAudio) {
      return;
    }

    setIsTranscribingAudio(true);
    const didStop = audioRecorder.stopRecording("transcribe");
    if (!didStop) {
      setIsTranscribingAudio(false);
    }
  };

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
    parentMemoName,
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

      {isAudioRecorderOpen && (audioRecorder.isBusy || isTranscribingAudio) && (
        <AudioRecorderPanel
          audioRecorder={{ status: audioRecorder.status, elapsedSeconds: audioRecorder.elapsedSeconds }}
          mediaStream={audioRecorder.recordingStream}
          onStop={audioRecorder.stopRecording}
          onCancel={handleCancelAudioRecording}
          onTranscribe={handleTranscribeAudioRecording}
          canTranscribe={canTranscribe}
          isTranscribing={isTranscribingAudio}
        />
      )}

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
          parentMemoName={parentMemoName}
          space={editorSpace}
          onAudioRecorderClick={handleAudioRecorderClick}
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
