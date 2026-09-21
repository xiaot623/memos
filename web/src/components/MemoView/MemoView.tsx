import {
  type ComponentType,
  forwardRef,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import type { MarkdownCaretPoint } from "@/components/MarkdownRuntime/focus";
import { useResolvedUser } from "@/components/MemoContent/MentionResolutionContext";
import { loadMemoEditor } from "@/components/MemoEditor/loader";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { isMemoBlurred } from "@/lib/tag";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { lazyWithReload } from "@/utils/lazy";
import { canManageMemo } from "@/utils/user";
import { MemoBody, MemoCommentListView, MemoHeader } from "./components";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import { useImagePreview } from "./hooks";
import { isInteractiveMemoClickTarget } from "./isInteractiveMemoClickTarget";
import { computeCommentAmount, MemoViewContext } from "./MemoViewContext";
import { isMemoDetailPath, resolveMemoParentPage } from "./navigation";
import type { MemoViewHandle, MemoViewProps } from "./types";

const MemoShareImageDialog = lazyWithReload(() => import("../MemoActionMenu/MemoShareImageDialog"));
const PreviewImageDialog = lazyWithReload(() => import("../PreviewImageDialog"));

const MemoView = forwardRef<MemoViewHandle, MemoViewProps>((props, ref) => {
  const {
    memo: memoData,
    className,
    parentPage: parentPageProp,
    compact,
    timeDisplay,
    showCreator,
    showVisibility,
    showPinned,
    showSpace,
  } = props;
  const cardRef = useRef<HTMLElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [EditorComponent, setEditorComponent] = useState<ComponentType<MemoEditorProps>>();
  const [cardWidth, setCardWidth] = useState(0);
  const [isBackgroundSaving, setIsBackgroundSaving] = useState(false);
  const [caretPoint, setCaretPoint] = useState<MarkdownCaretPoint | null>(null);
  const draftRef = useRef(memoData.content);

  const currentUser = useCurrentUser();
  const { userTagsSetting } = useAuth();
  const creator = useResolvedUser(memoData.creator, { enabled: Boolean(showCreator || props.shareImageDialogOpen) });
  const isArchived = memoData.state === State.ARCHIVED;
  const readonly = !canManageMemo(memoData, currentUser);
  const canEdit = !readonly && !isArchived;
  const location = useLocation();
  const parentPage = resolveMemoParentPage({
    explicitParentPage: parentPageProp,
    pathname: location.pathname,
    search: location.search,
    memoName: memoData.name,
  });
  const isInMemoDetailPage = isMemoDetailPath(location.pathname, memoData.name);
  const isEditing = showEditor && isInMemoDetailPage;
  const showCommentPreview = !isInMemoDetailPage && computeCommentAmount(memoData) > 0;

  // Blur content when any tag has blur_content enabled in the current user's tag settings.
  const [showBlurredContent, setShowBlurredContent] = useState(false);
  const blurred = isMemoBlurred(memoData, userTagsSetting);
  const toggleBlurVisibility = useCallback(() => setShowBlurredContent((prev) => !prev), []);

  const { previewState, openPreview, setPreviewOpen } = useImagePreview();
  const { mutate: updateMemo } = useUpdateMemo();

  const closeEditor = useCallback(() => {
    setCaretPoint(null);
    setShowEditor(false);
  }, []);
  const openEditor = useCallback(() => {
    if (showEditor) {
      return;
    }
    if (isInMemoDetailPage) {
      draftRef.current = memoData.content;
      setShowEditor(true);
      return;
    }
    void loadMemoEditor()
      .then(({ default: MemoEditor }) => {
        setEditorComponent(() => MemoEditor);
        setShowEditor(true);
      })
      .catch(() => undefined);
  }, [isInMemoDetailPage, memoData.content, showEditor]);
  const saveEditor = useCallback(() => {
    if (!isInMemoDetailPage) {
      return;
    }
    if (draftRef.current === memoData.content) {
      closeEditor();
      return;
    }
    setIsBackgroundSaving(true);
    updateMemo(
      { update: { name: memoData.name, content: draftRef.current }, updateMask: ["content", "update_time"] },
      {
        onSuccess: () => closeEditor(),
        onSettled: () => setIsBackgroundSaving(false),
      },
    );
  }, [closeEditor, isInMemoDetailPage, memoData.content, memoData.name, updateMemo]);
  const onDraftChange = useCallback((content: string) => {
    draftRef.current = content;
  }, []);

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit || showEditor) return;
      if (isInteractiveMemoClickTarget(e.target)) return;
      if (isInMemoDetailPage) {
        setCaretPoint({ x: e.clientX, y: e.clientY });
      }
      openEditor();
    },
    [canEdit, isInMemoDetailPage, openEditor, showEditor],
  );

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      saveEditor();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditing, saveEditor]);

  useImperativeHandle(ref, () => ({ openEditor }), [openEditor]);

  // The card width is only needed by the share-image dialog. Keep feed cards
  // free of a permanent ResizeObserver and measure only while that dialog is open.
  useLayoutEffect(() => {
    if (!props.shareImageDialogOpen) {
      return;
    }

    const card = cardRef.current;
    if (!card) {
      return;
    }

    const updateWidth = (nextWidth?: number) => {
      const width = Math.round(nextWidth ?? card.getBoundingClientRect().width);
      setCardWidth((prev) => (prev === width ? prev : width));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => updateWidth();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width);
    });

    resizeObserver.observe(card);
    return () => resizeObserver.disconnect();
  }, [props.shareImageDialogOpen]);

  const contextValue = useMemo(
    () => ({
      memo: memoData,
      creator,
      currentUser,
      parentPage,
      cardWidth,
      isArchived,
      readonly,
      showBlurredContent,
      blurred,
      isEditing,
      caretPoint,
      openEditor,
      saveEditor,
      onDraftChange,
      isSaving: isBackgroundSaving,
      toggleBlurVisibility,
      openPreview,
    }),
    [
      memoData,
      creator,
      currentUser,
      parentPage,
      cardWidth,
      isArchived,
      readonly,
      showBlurredContent,
      blurred,
      isEditing,
      caretPoint,
      openEditor,
      saveEditor,
      onDraftChange,
      isBackgroundSaving,
      toggleBlurVisibility,
      openPreview,
    ],
  );

  const article = (
    <article
      className={cn(
        MEMO_CARD_BASE_CLASSES,
        canEdit && (isEditing ? "cursor-text" : "cursor-pointer"),
        showCommentPreview ? "mb-0 rounded-b-none" : "mb-2",
        className,
      )}
      ref={cardRef}
      tabIndex={readonly ? -1 : 0}
      aria-busy={isBackgroundSaving || undefined}
      onClick={canEdit ? handleCardClick : undefined}
    >
      <MemoHeader
        timeDisplay={timeDisplay}
        showCreator={showCreator}
        showVisibility={showVisibility}
        showPinned={showPinned}
        showSpace={showSpace}
      />

      <MemoBody compact={compact} />

      {previewState.items.length > 0 && (
        <Suspense fallback={null}>
          <PreviewImageDialog
            open={previewState.open}
            onOpenChange={setPreviewOpen}
            items={previewState.items}
            initialIndex={previewState.index}
          />
        </Suspense>
      )}

      {props.onShareImageDialogOpenChange && props.shareImageDialogOpen && (
        <Suspense fallback={null}>
          <MemoShareImageDialog open onOpenChange={props.onShareImageDialogOpenChange} />
        </Suspense>
      )}
    </article>
  );

  const memoDisplay = showCommentPreview ? (
    <div className="w-full mb-2">
      {article}
      <MemoCommentListView />
    </div>
  ) : (
    article
  );

  return (
    <MemoViewContext.Provider value={contextValue}>
      {memoDisplay}
      {showEditor && !isInMemoDetailPage && EditorComponent && (
        <EditorComponent
          autoFocus
          presentation="peek"
          cacheKey={`inline-memo-editor-${memoData.name}`}
          memo={memoData}
          parentMemoName={memoData.parent || undefined}
          onConfirm={closeEditor}
          onCancel={closeEditor}
          onSavingChange={setIsBackgroundSaving}
        />
      )}
    </MemoViewContext.Provider>
  );
});

MemoView.displayName = "MemoView";

export default memo(MemoView);
