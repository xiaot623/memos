import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";

const state = vi.hoisted(() => ({
  authInitialized: true,
  currentUser: { name: "users/1" } as { name: string } | undefined,
  selectedSpaceName: undefined as string | undefined,
  editorProps: undefined as Record<string, unknown> | undefined,
  listProps: undefined as Record<string, unknown> | undefined,
  memoViewProps: undefined as Record<string, unknown> | undefined,
  memoFilterOptions: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/components/MemoEditor", () => ({
  default: (props: Record<string, unknown>) => {
    state.editorProps = props;
    return <div data-testid="memo-editor" />;
  },
}));

vi.mock("@/components/MemoView", () => ({
  default: (props: Record<string, unknown>) => {
    state.memoViewProps = props;
    return <div data-testid="memo-view" />;
  },
}));

vi.mock("@/components/PagedMemoList", () => ({
  default: ({
    renderer,
    renderLeading,
    ...props
  }: {
    renderer: (memo: { name: string }, options: { compact: boolean }) => React.ReactNode;
    renderLeading: (options: { useGrid: boolean }) => React.ReactNode;
  } & Record<string, unknown>) => {
    state.listProps = props;
    return (
      <>
        {renderLeading?.({ useGrid: false })}
        {renderer({ name: "memos/1" }, { compact: false })}
      </>
    );
  },
  getMemoKey: (memo: { name: string }) => memo.name,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isUserSettingsInitialized: true, isInitialized: state.authInitialized }),
}));

vi.mock("@/contexts/GlobalMemoEditorContext", () => ({
  useGlobalMemoEditor: () => ({ claimHomeAutoFocus: () => true }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  useMemoFilterContext: () => ({ filters: [] }),
}));

vi.mock("@/contexts/NewMemoContext", () => ({
  NewMemoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({
    selectedSpaceName: state.selectedSpaceName,
    memoFilter: state.selectedSpaceName ? `space == "${state.selectedSpaceName}"` : undefined,
  }),
}));

vi.mock("@/hooks", () => ({
  useMemoFilters: (options: Record<string, unknown>) => {
    state.memoFilterOptions = options;
    return "";
  },
  useMemoSorting: () => ({ listSort: undefined, orderBy: "create_time desc" }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => state.currentUser,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("<Home>", () => {
  it("renders the editor and memo cards synchronously without blank placeholders", () => {
    state.authInitialized = true;
    state.currentUser = { name: "users/1" };
    state.selectedSpaceName = undefined;
    render(<Home />);

    expect(screen.getByTestId("memo-editor")).toBeInTheDocument();
    expect(screen.getByTestId("memo-view")).toBeInTheDocument();
    expect(state.listProps).toMatchObject({ contextFilter: undefined });
    expect(state.memoFilterOptions).toMatchObject({ creatorName: "users/1" });
    expect(state.memoViewProps).toMatchObject({ showCreator: false });
    expect(state.editorProps).toMatchObject({ cacheKey: "home-memo-editor", defaultSpace: undefined });
    expect(state.editorProps?.autoFocus).toEqual(expect.any(Function));
  });

  it("shows the public feed without the editor when nobody is signed in", () => {
    state.authInitialized = true;
    state.currentUser = undefined;
    state.selectedSpaceName = undefined;
    render(<Home />);

    expect(screen.queryByTestId("memo-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("memo-view")).toBeInTheDocument();
    expect(state.memoFilterOptions).toMatchObject({ visibilities: [3] });
    expect(state.memoViewProps).toMatchObject({ showCreator: true });
  });

  it("filters the feed and sets new memo placement to the selected Space", () => {
    state.authInitialized = true;
    state.currentUser = { name: "users/1" };
    state.selectedSpaceName = "spaces/product";
    render(<Home />);

    expect(state.listProps).toMatchObject({ contextFilter: 'space == "spaces/product"' });
    expect(state.memoFilterOptions).toMatchObject({ creatorName: undefined });
    expect(state.memoViewProps).toMatchObject({ showCreator: true });
    expect(state.editorProps).toMatchObject({
      cacheKey: "home-memo-editor:spaces/product",
      defaultSpace: "spaces/product",
    });
  });
});
