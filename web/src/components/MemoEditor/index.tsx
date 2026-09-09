import { Maximize2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
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
import { useAudioRecorder, useAutoSave, useFocusMode, useMemoInit, useMemoSave } from "./hooks";
import { errorService, transcriptionService } from "./services";
import { EditorProvider, useEditorContext, useEditorSelector } from "./state";
import { EditorToolbar, FormattingToolbar } from "./Toolbar";
import type { MemoEditorProps } from "./types";
import type { LocalFile } from "./types/attachment";
import type { EditorController } from "./types/editorController";

const MemoEditor = (props: MemoEditorProps) => (
  <EditorProvider>
    <MemoEditorImpl {...props} />
  </EditorProvider>
);

const MemoEditorImpl: React.FC<MemoEditorProps> = ({
  className,
  cacheKey,
  memo,
  parentMemoName,
  autoFocus,
  presentation = "inline",
  placeholder,
  defaultCreateTime,
  onConfirm,
  onCancel,
  onSavingChange,
}) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const editorRef = useRef<EditorController>(null);
  const { actions, dispatch } = useEditorContext();
  // Subscribe only to the low-frequency slices this component renders from, so
  // typing (which changes content) does not re-render the editor shell and its
  // toolbar/metadata children.
  const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
  const hasTimestamp = useEditorSelector((s) => Boolean(s.timestamps.createTime));
  const { userGeneralSetting } = useAuth();
  const { aiSetting, fetchSetting } = useInstance();
  const [isAudioRecorderOpen, setIsAudioRecorderOpen] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  // Persisted preference: also show the formatting toolbar in normal mode. Focus
  // mode always shows it regardless; this only governs the non-focus layout.
  const [isFormattingToolbarVisible, setFormattingToolbarVisible] = useLocalStorage(FORMATTING_TOOLBAR_STORAGE_KEY, false);

  const memoName = memo?.name;
  const isPeek = presentation === "peek";
  const canTranscribe = useMemo(() => {
    const providerId = aiSetting.transcription?.providerId ?? "";
    if (!providerId) return false;
    const provider = aiSetting.providers.find((p) => p.id === providerId);
    return Boolean(provider?.apiKeySet);
  }, [aiSetting.providers, aiSetting.transcription?.providerId]);

  // Get default visibility from user settings
  const defaultVisibility = userGeneralSetting?.memoVisibility ? convertVisibilityFromString(userGeneralSetting.memoVisibility) : undefined;

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

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  const handleToggleFormattingToolbar = useCallback(() => {
    setFormattingToolbarVisible((visible) => !visible);
  }, [setFormattingToolbarVisible]);

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

  const saveMemo = useMemoSave({
    memoName,
    parentMemoName,
    defaultVisibility,
    defaultCreateTime,
    discardDraft,
    onConfirm,
    onCancel,
    onSavingChange,
  });
  const handleSave = useCallback(() => saveMemo(isPeek ? { closeImmediately: true } : undefined), [isPeek, saveMemo]);
  const handleDismiss = useCallback(() => {
    void saveMemo({ closeIfUnchanged: true, closeImmediately: true });
  }, [saveMemo]);

  const showTimestamp = Boolean(memoName || (!memo && hasTimestamp));
  const showPeekMaximize = isPeek && !isFocusMode;

  const editorCard = (
    <div
      ref={editorContainerRef}
      className={cn(
        "group relative w-full flex flex-col justify-between items-start bg-card px-4 pt-3 pb-1 rounded-lg border border-border gap-2",
        FOCUS_MODE_STYLES.transition,
        isPeek && !isFocusMode && PEEK_MODE_STYLES.container,
        isPeek && isFocusMode && PEEK_MODE_STYLES.focusContainer,
        !isPeek && isFocusMode && cn(FOCUS_MODE_STYLES.container.base, FOCUS_MODE_STYLES.container.spacing),
        !isPeek && !isFocusMode && className,
      )}
    >
      {/* Formatting toolbar. Always shown in focus mode (with an exit button);
          in normal mode it appears only when the user toggled it on via the
          insert menu. */}
      {(isFocusMode || isFormattingToolbarVisible) && (
        <FormattingToolbar controllerRef={editorRef} onExit={isFocusMode ? handleToggleFocusMode : undefined} />
      )}

      {(showTimestamp || showPeekMaximize) && (
        <div className="w-full -mb-1 flex items-start justify-between gap-2">
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

      {/* Editor content grows to fill available space in focus mode */}
      <EditorContent ref={editorRef} placeholder={placeholder} onSubmit={handleSave} />

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

      {/* Metadata and toolbar grouped together at bottom */}
      <div className="w-full flex flex-col gap-2">
        <EditorMetadata memoName={memoName} />
        <EditorToolbar
          onSave={handleSave}
          onCancel={onCancel}
          memoName={memoName}
          onAudioRecorderClick={handleAudioRecorderClick}
          isFormattingToolbarVisible={isFormattingToolbarVisible}
          onToggleFormattingToolbar={handleToggleFormattingToolbar}
        />
      </div>
    </div>
  );

  if (isPeek) {
    return (
      <PeekEditorDialog isFocusMode={isFocusMode} title={t("common.edit")} onDismiss={handleDismiss}>
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
