import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import MemoView from "@/components/MemoView";
import { State } from "@/types/proto/api/v1/common_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const mocks = vi.hoisted(() => ({
  currentUser: { name: "users/alice" } as { name: string } | undefined,
  loadMemoEditor: vi.fn(),
  editorProps: undefined as MemoEditorProps | undefined,
}));

vi.mock("@/components/MemoEditor/loader", () => ({
  loadMemoEditor: mocks.loadMemoEditor,
}));

vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  useResolvedUser: () => undefined,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ userTagsSetting: undefined }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => mocks.currentUser,
}));

vi.mock("@/hooks/useMemoQueries", () => ({
  useUpdateMemo: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/components/MemoView/components/MemoHeader", () => ({
  default: () => (
    <button type="button" aria-label="goto-detail">
      timestamp
    </button>
  ),
}));

vi.mock("@/components/MemoView/components/MemoBody", () => ({
  default: () => (
    <div>
      <p>note body</p>
      <span data-tag="inbox">#inbox</span>
    </div>
  ),
}));

vi.mock("@/components/MemoView/components/MemoCommentListView", () => ({
  default: () => null,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const MockPeekEditor = (props: MemoEditorProps) => {
  mocks.editorProps = props;
  return (
    <div data-testid="peek-editor" data-presentation={props.presentation}>
      peek editor
    </div>
  );
};

const wrapper =
  (path = "/") =>
  ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

const renderMemo = (creator = "users/alice", path = "/") =>
  render(
    <MemoView
      memo={create(MemoSchema, {
        name: "memos/1",
        creator,
        content: "aaa",
        state: State.NORMAL,
      })}
    />,
    { wrapper: wrapper(path) },
  );

describe("<MemoView> peek editor", () => {
  beforeEach(() => {
    mocks.currentUser = { name: "users/alice" };
    mocks.editorProps = undefined;
    mocks.loadMemoEditor.mockReset().mockResolvedValue({ default: MockPeekEditor });
  });

  it("opens a peek editor on card click and keeps the original card", async () => {
    renderMemo();

    fireEvent.click(screen.getByText("note body"));

    await waitFor(() => expect(screen.getByTestId("peek-editor")).toBeInTheDocument());
    expect(screen.getByTestId("peek-editor")).toHaveAttribute("data-presentation", "peek");
    expect(screen.getByText("note body")).toBeInTheDocument();
  });

  it("keeps the reading card and does not open a peek editor on the detail page", async () => {
    renderMemo("users/alice", "/memos/1");

    fireEvent.click(screen.getByText("note body"));

    await Promise.resolve();
    expect(screen.queryByTestId("peek-editor")).toBeNull();
    expect(mocks.loadMemoEditor).not.toHaveBeenCalled();
    expect(screen.getByText("note body")).toBeInTheDocument();
  });

  it("does not open the editor when clicking a timestamp or tag", async () => {
    renderMemo();

    fireEvent.click(screen.getByRole("button", { name: "goto-detail" }));
    fireEvent.click(screen.getByText("#inbox"));

    await Promise.resolve();
    expect(screen.queryByTestId("peek-editor")).toBeNull();
    expect(mocks.loadMemoEditor).not.toHaveBeenCalled();
  });

  it("does not open the editor for someone else's memo", async () => {
    mocks.currentUser = { name: "users/bob" };
    renderMemo();

    fireEvent.click(screen.getByText("note body"));

    await Promise.resolve();
    expect(screen.queryByTestId("peek-editor")).toBeNull();
    expect(mocks.loadMemoEditor).not.toHaveBeenCalled();
  });

  it("opens the editor from the keyboard when the card is focused", async () => {
    renderMemo();

    const card = screen.getByRole("article");
    card.focus();
    fireEvent.keyDown(card, { key: "Enter" });

    await waitFor(() => expect(screen.getByTestId("peek-editor")).toBeInTheDocument());
  });

  it("marks the card busy while a background save is in flight", async () => {
    renderMemo();
    fireEvent.click(screen.getByText("note body"));
    await waitFor(() => expect(mocks.editorProps).toBeDefined());

    act(() => {
      mocks.editorProps?.onSavingChange?.(true);
      mocks.editorProps?.onConfirm?.("memos/1");
    });

    expect(screen.queryByTestId("peek-editor")).toBeNull();
    expect(screen.getByRole("article")).toHaveAttribute("aria-busy", "true");

    act(() => {
      mocks.editorProps?.onSavingChange?.(false);
    });
    expect(screen.getByRole("article")).not.toHaveAttribute("aria-busy");
  });
});
