import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { useNewMemo } from "@/contexts/NewMemoContext";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import type { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { errorService, memoService, validationService } from "../services";
import { useEditorContext } from "../state";

interface UseMemoSaveOptions {
  memoName?: string;
  parentMemoName?: string;
  defaultVisibility?: Visibility;
  defaultCreateTime?: Date;
  discardDraft: () => void;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
  /** Reports save activity so a list card can keep a spinner after the peek overlay closes. */
  onSavingChange?: (isSaving: boolean) => void;
}

export interface SaveMemoOptions {
  /** Peek/backdrop dismiss: close quietly when the document is unchanged. */
  closeIfUnchanged?: boolean;
  /** Close the host before the network round-trip. Used by the peek overlay. */
  closeImmediately?: boolean;
}

/**
 * Owns the editor's save transaction and its post-save cache/state updates.
 * Keeping this workflow outside the shell makes saving identical whether it is
 * triggered by the toolbar or the editor keyboard shortcut.
 */
export function useMemoSave({
  memoName,
  parentMemoName,
  defaultVisibility,
  defaultCreateTime,
  discardDraft,
  onConfirm,
  onCancel,
  onSavingChange,
}: UseMemoSaveOptions): (options?: SaveMemoOptions) => Promise<void> {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const { markNewMemo } = useNewMemo();
  const { actions, dispatch, getState } = useEditorContext();
  const closeImmediatelyStartedRef = useRef(false);

  return useCallback(
    async (options?: SaveMemoOptions) => {
      const state = getState();
      const { valid, reason } = validationService.canSave(state);
      if (!valid) {
        toast.error(reason || "Cannot save");
        return;
      }

      const invalidateAfterSave = () => {
        const invalidationPromises: Promise<unknown>[] = [
          queryClient.invalidateQueries({ queryKey: memoKeys.lists() }),
          queryClient.invalidateQueries({ queryKey: userKeys.stats() }),
        ];
        if (memoName) {
          invalidationPromises.push(queryClient.invalidateQueries({ queryKey: memoKeys.detail(memoName) }));
        }
        if (parentMemoName) {
          invalidationPromises.push(queryClient.invalidateQueries({ queryKey: memoKeys.comments(parentMemoName) }));
        }
        return invalidationPromises;
      };

      if (options?.closeImmediately) {
        if (closeImmediatelyStartedRef.current) return;
        closeImmediatelyStartedRef.current = true;
        discardDraft();
        onSavingChange?.(true);
        onConfirm?.(memoName ?? "");
        try {
          const result = await memoService.save(state, { memoName, parentMemoName });
          if (!result.hasChanges) return;
          await Promise.all(invalidateAfterSave());
        } catch (error) {
          handleError(error, toast.error, {
            context: "Failed to save memo",
            fallbackMessage: errorService.getErrorMessage(error),
          });
        } finally {
          onSavingChange?.(false);
        }
        return;
      }

      dispatch(actions.setLoading("saving", true));

      try {
        const result = await memoService.save(state, { memoName, parentMemoName });

        if (!result.hasChanges) {
          if (!options?.closeIfUnchanged) {
            toast.error(t("editor.no-changes-detected"));
          }
          onCancel?.();
          return;
        }

        // Prevent the autosave unmount flush from restoring the saved draft.
        discardDraft();

        await Promise.all(invalidateAfterSave());

        dispatch(actions.reset());
        if (!memoName && defaultVisibility) {
          dispatch(actions.setMetadata({ visibility: defaultVisibility }));
        }
        // Reset creates a fresh editor state, so restore calendar-derived values
        // for the next memo created without remounting this composer.
        if (!memoName && defaultCreateTime) {
          dispatch(actions.setTimestamps({ createTime: defaultCreateTime, updateTime: defaultCreateTime }));
        }

        if (!memoName && !parentMemoName) {
          markNewMemo(result.memoName);
        }
        onConfirm?.(result.memoName);
      } catch (error) {
        handleError(error, toast.error, {
          context: "Failed to save memo",
          fallbackMessage: errorService.getErrorMessage(error),
        });
      } finally {
        dispatch(actions.setLoading("saving", false));
      }
    },
    [
      actions,
      defaultCreateTime,
      defaultVisibility,
      discardDraft,
      dispatch,
      getState,
      markNewMemo,
      memoName,
      onCancel,
      onConfirm,
      onSavingChange,
      parentMemoName,
      queryClient,
      t,
    ],
  );
}
