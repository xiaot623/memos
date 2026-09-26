import { CheckIcon, CornerDownLeftIcon, LoaderIcon } from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { primaryModifierGlyph } from "@/utils/platform";
import { validationService } from "../services";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorToolbarProps } from "../types";
import InsertMenu from "./InsertMenu";
import VisibilitySelector from "./VisibilitySelector";

/**
 * Shortcut chip inside the commit button. While saving, a spinner takes the
 * chip's place; both layers share one grid cell so the button keeps its width
 * across the swap. Hidden on coarse pointers, where there is no keyboard to hint.
 */
const ShortcutChip: FC<{ busy: boolean }> = ({ busy }) => (
  <kbd
    aria-hidden
    className="grid place-items-center rounded-[4px] bg-primary-foreground/20 px-1 py-0.5 font-sans text-2xs leading-none font-medium pointer-coarse:hidden"
  >
    <span className={cn("col-start-1 row-start-1 inline-flex items-center gap-px", busy && "invisible")}>
      {primaryModifierGlyph()}
      <CornerDownLeftIcon className="size-2.5" strokeWidth={2.5} />
    </span>
    <LoaderIcon className={cn("col-start-1 row-start-1 size-2.5 animate-spin", !busy && "invisible")} strokeWidth={3} />
  </kbd>
);

export const EditorToolbar: FC<EditorToolbarProps> = ({
  onSave,
  onCancel,
  memoName,
  space,
  viewToggles,
  onInsertImages,
  isRawMode,
  onToggleRawMode,
}) => {
  const t = useTranslate();
  const { actions, dispatch } = useEditorContext();
  const valid = useEditorSelector((s) => validationService.canSave(s).valid);
  const blockedReason = useEditorSelector((s) => validationService.canSave(s).reason);
  const blockedReasonDetail = useEditorSelector((s) => validationService.canSave(s).detail);
  const isSaving = useEditorSelector((s) => s.ui.isLoading.saving);
  const justSaved = useEditorSelector((s) => s.ui.justSaved);
  const isUploading = useEditorSelector((s) => s.ui.isLoading.uploading);
  const visibility = useEditorSelector((s) => s.metadata.visibility);
  const committing = isSaving || justSaved;
  const blockedMessage =
    valid || committing
      ? undefined
      : blockedReason
        ? t(blockedReason, blockedReasonDetail ? { url: blockedReasonDetail } : undefined)
        : t("editor.validation.cannot-save");
  const commitLabel = memoName ? t("common.update") : t("editor.save");

  const handleVisibilityChange = (next: Visibility) => {
    dispatch(actions.setMetadata({ visibility: next }));
  };

  const commitButton = justSaved ? (
    <Button size="sm" disabled>
      {t("editor.saved")}
      <CheckIcon className="size-3.5" strokeWidth={2.5} />
    </Button>
  ) : (
    <Button size="sm" onClick={onSave} disabled={isSaving || !valid}>
      {commitLabel}
      <ShortcutChip busy={isSaving} />
    </Button>
  );

  return (
    <div className="flex w-full flex-row items-center justify-between">
      <div className="flex flex-row items-center justify-start gap-1">
        <InsertMenu
          isUploading={isUploading}
          isSaving={committing}
          memoName={memoName}
          viewToggles={viewToggles}
          onInsertImages={onInsertImages}
          isRawMode={isRawMode}
          onToggleRawMode={onToggleRawMode}
        />
        <VisibilitySelector value={visibility} space={space} onChange={handleVisibilityChange} />
      </div>

      <div className="flex flex-row items-center justify-end gap-1">
        {onCancel && (
          <Button variant="quiet" size="sm" onClick={onCancel} disabled={committing}>
            {t("common.cancel")}
          </Button>
        )}

        {blockedMessage ? (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" tabIndex={0} aria-label={blockedMessage} />}>
              {commitButton}
            </TooltipTrigger>
            <TooltipContent side="top">{blockedMessage}</TooltipContent>
          </Tooltip>
        ) : (
          commitButton
        )}
      </div>
    </div>
  );
};
