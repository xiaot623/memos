import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoSave } from "@/components/MemoEditor/hooks/useMemoSave";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  markNewMemo: vi.fn(),
  memoSave: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/components/MemoEditor/services", () => ({
  errorService: { getErrorMessage: () => "save failed" },
  memoService: { save: mocks.memoSave },
  validationService: { canSave: () => ({ valid: true }) },
}));

vi.mock("@/components/MemoEditor/state", () => ({
  useEditorContext: () => ({
    actions: {
      reset: () => ({ type: "reset" }),
      setLoading: (key: string, value: boolean) => ({ type: "set-loading", key, value }),
      setMetadata: () => ({ type: "set-metadata" }),
      setTimestamps: () => ({ type: "set-timestamps" }),
    },
    dispatch: mocks.dispatch,
    getState: () => ({ ui: { isLoading: { saving: false } } }),
  }),
}));

vi.mock("@/contexts/NewMemoContext", () => ({
  useNewMemo: () => ({ markNewMemo: mocks.markNewMemo }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
  },
}));

describe("useMemoSave", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.markNewMemo.mockReset();
    mocks.memoSave.mockReset();
    mocks.toastError.mockReset();
  });

  it("closes silently on dismiss when nothing changed", async () => {
    mocks.memoSave.mockResolvedValue({ hasChanges: false, memoName: "memos/existing" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const onCancel = vi.fn();
    const { result } = renderHook(() => useMemoSave({ memoName: "memos/existing", discardDraft: vi.fn(), onCancel }), { wrapper });

    await act(async () => result.current({ closeIfUnchanged: true }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("closes immediately and saves in the background", async () => {
    let resolveSave: (value: { hasChanges: boolean; memoName: string }) => void = () => undefined;
    mocks.memoSave.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const onConfirm = vi.fn();
    const onSavingChange = vi.fn();
    const { result } = renderHook(() => useMemoSave({ memoName: "memos/existing", discardDraft: vi.fn(), onConfirm, onSavingChange }), {
      wrapper,
    });

    let savePromise: Promise<void> = Promise.resolve();
    await act(async () => {
      savePromise = result.current({ closeImmediately: true });
    });

    expect(onConfirm).toHaveBeenCalledWith("memos/existing");
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(onSavingChange).toHaveBeenCalledWith(true);

    await act(async () => {
      resolveSave({ hasChanges: true, memoName: "memos/existing" });
      await savePromise;
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["memos", "list"] });
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
  });

  it("still toasts when an explicit save has no changes", async () => {
    mocks.memoSave.mockResolvedValue({ hasChanges: false, memoName: "memos/existing" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const onCancel = vi.fn();
    const { result } = renderHook(() => useMemoSave({ memoName: "memos/existing", discardDraft: vi.fn(), onCancel }), { wrapper });

    await act(async () => result.current());

    expect(onCancel).toHaveBeenCalledOnce();
    expect(mocks.toastError).toHaveBeenCalledWith("editor.no-changes-detected");
  });
});
