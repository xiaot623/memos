import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorContent } from "@/components/MemoEditor/components/EditorContent";
import { EditorProvider } from "@/components/MemoEditor/state";
import { createInitialState } from "@/components/MemoEditor/state/types";

vi.mock("@/components/MemoEditor/Wysiwyg", () => ({
  default: () => <div data-testid="wysiwyg-editor" />,
}));

vi.mock("@/components/MemoEditor/Editor", () => ({
  default: () => <div data-testid="source-editor" />,
}));

vi.mock("@/components/MemoEditor/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/MemoEditor/hooks")>();
  return {
    ...actual,
    useBlobUrls: () => ({ createBlobUrl: (file: File) => URL.createObjectURL(file) }),
  };
});

describe("EditorContent", () => {
  it("hosts the WYSIWYG editor by default", () => {
    const { container } = render(
      <EditorProvider>
        <EditorContent placeholder="" onSubmit={() => {}} />
      </EditorProvider>,
    );
    expect(screen.getByTestId("wysiwyg-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("source-editor")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("min-h-0", "min-w-0");
  });

  it("falls back to the CodeMirror source editor in raw mode", () => {
    const initial = createInitialState();
    initial.ui.isRawMode = true;
    render(
      <EditorProvider initialEditorState={initial}>
        <EditorContent placeholder="" onSubmit={() => {}} />
      </EditorProvider>,
    );
    expect(screen.getByTestId("source-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("wysiwyg-editor")).not.toBeInTheDocument();
  });
});
