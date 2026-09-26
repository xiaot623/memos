import { EyeIcon } from "lucide-react";
import { useMemo } from "react";
import ClampedSection from "@/components/ClampedSection";
import { AttachmentGallery, MemoMetadataRows } from "@/components/MemoMetadata";
import { separateAttachments } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { filterInlineManagedAttachments } from "@/utils/managed-attachment";
import MemoContent from "../../MemoContent";
import { MemoReactionListView } from "../../MemoReactionListView";
import { useMemoHandlers } from "../hooks";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";
import type { MemoBodyProps } from "../types";

const BlurOverlay: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const t = useTranslate();
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        <EyeIcon className="size-3.5" strokeWidth={1.8} />
        {t("memo.click-to-show-sensitive-content")}
      </Button>
    </div>
  );
};

const MemoBody: React.FC<MemoBodyProps> = ({ compact }) => {
  const {
    memo,
    parentPage,
    showBlurredContent,
    blurred,
    openPreview,
    toggleBlurVisibility,
    isEditing,
    caretPoint,
    onDraftChange,
    saveEditor,
    readonly,
  } = useMemoViewContext();
  const { isInMemoDetailPage, isArchived } = useMemoViewDerived();
  const inPlace = isInMemoDetailPage && !readonly && !isArchived;

  const { handleMemoContentClick } = useMemoHandlers({ openPreview });

  const attachmentOnlyItems = useMemo(
    () => filterInlineManagedAttachments(memo.content, memo.attachments),
    [memo.content, memo.attachments],
  );
  const { visual, audio, docs } = useMemo(() => separateAttachments(attachmentOnlyItems), [attachmentOnlyItems]);

  return (
    <div className="w-full flex flex-col justify-start items-start gap-2">
      <div data-slot="memo-body" className="relative w-full">
        <div
          className={cn(
            "w-full flex flex-col justify-start items-start gap-2",
            blurred && !showBlurredContent && "blur-lg transition-all duration-200",
          )}
        >
          <ClampedSection enabled={Boolean(compact)}>
            <MemoContent
              memoName={memo.name}
              parentPage={parentPage}
              content={memo.content}
              attachments={memo.attachments}
              onClick={handleMemoContentClick}
              compact={Boolean(compact)}
              editable={isEditing}
              inPlace={inPlace}
              caretPoint={caretPoint}
              onContentChange={onDraftChange}
              onSubmit={saveEditor}
              onBlur={saveEditor}
            />
            <AttachmentGallery visual={visual} onImagePreview={openPreview} />
            <MemoMetadataRows audio={audio} docs={docs} currentMemoName={memo.name} parentPage={parentPage} />
          </ClampedSection>
        </div>

        {blurred && !showBlurredContent && <BlurOverlay onClick={toggleBlurVisibility} />}
      </div>

      <MemoReactionListView memo={memo} reactions={memo.reactions} />
    </div>
  );
};

export default MemoBody;
