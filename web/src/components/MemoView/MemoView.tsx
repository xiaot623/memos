import { type ComponentType, forwardRef, memo, Suspense, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { loadMemoEditor } from "@/components/MemoEditor/loader";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUser } from "@/hooks/useUserQueries";
import { isMemoBlurred } from "@/lib/tag";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { lazyWithReload } from "@/utils/lazy";
import { canManageMemo } from "@/utils/user";
import { MemoBody, MemoHeader } from "./components";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import { useImagePreview } from "./hooks";
import { isMemoCardSurfaceClick } from "./isInteractiveMemoClickTarget";
import { MemoViewContext } from "./MemoViewContext";
import { resolveMemoParentPage } from "./navigation";
import type { MemoViewHandle, MemoViewProps } from "./types";

const PreviewImageDialog = lazyWithReload(() => import("../PreviewImageDialog"));

const MemoView = forwardRef<MemoViewHandle, MemoViewProps>((props, ref) => {
  const { memo: memoData, className, parentPage: parentPageProp, compact, timeDisplay, showCreator, showPinned, showSpace } = props;
  const cardRef = useRef<HTMLElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [EditorComponent, setEditorComponent] = useState<ComponentType<MemoEditorProps>>();
  const [isBackgroundSaving, setIsBackgroundSaving] = useState(false);

  const currentUser = useCurrentUser();
  const { userTagsSetting } = useAuth();
  const { data: creator } = useUser(memoData.creator, {
    enabled: Boolean(showCreator && memoData.creator),
  });
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

  const [showBlurredContent, setShowBlurredContent] = useState(false);
  const blurred = isMemoBlurred(memoData, userTagsSetting);
  const toggleBlurVisibility = useCallback(() => setShowBlurredContent((prev) => !prev), []);

  const { previewState, openPreview, setPreviewOpen } = useImagePreview();

  const closeEditor = useCallback(() => {
    setShowEditor(false);
  }, []);
  const openEditor = useCallback(() => {
    if (showEditor) {
      return;
    }
    void loadMemoEditor()
      .then(({ default: MemoEditor }) => {
        setEditorComponent(() => MemoEditor);
        setShowEditor(true);
      })
      .catch(() => undefined);
  }, [showEditor]);

  const handleCardDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit || showEditor) return;
      if (!isMemoCardSurfaceClick(e)) return;
      openEditor();
    },
    [canEdit, openEditor, showEditor],
  );

  useImperativeHandle(ref, () => ({ openEditor }), [openEditor]);

  const contextValue = useMemo(
    () => ({
      memo: memoData,
      creator,
      currentUser,
      parentPage,
      cardWidth: 0,
      isArchived,
      readonly,
      showBlurredContent,
      blurred,
      openEditor,
      isSaving: isBackgroundSaving,
      toggleBlurVisibility,
      openPreview,
    }),
    [
      memoData,
      creator,
      currentUser,
      parentPage,
      isArchived,
      readonly,
      showBlurredContent,
      blurred,
      openEditor,
      isBackgroundSaving,
      toggleBlurVisibility,
      openPreview,
    ],
  );

  return (
    <MemoViewContext.Provider value={contextValue}>
      <article
        className={cn(MEMO_CARD_BASE_CLASSES, canEdit && "cursor-pointer", "mb-2", className)}
        ref={cardRef}
        tabIndex={readonly ? -1 : 0}
        aria-busy={isBackgroundSaving || undefined}
        onDoubleClickCapture={canEdit ? handleCardDoubleClick : undefined}
      >
        <MemoHeader timeDisplay={timeDisplay} showCreator={showCreator} showPinned={showPinned} showSpace={showSpace} />

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
      </article>
      {showEditor && EditorComponent && (
        <EditorComponent
          autoFocus
          presentation="peek"
          cacheKey={`inline-memo-editor-${memoData.name}`}
          memo={memoData}
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
