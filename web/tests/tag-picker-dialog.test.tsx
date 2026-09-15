import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TagPickerDialog } from "@/components/MemoEditor/Toolbar/TagPickerDialog";

vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: () => ({ data: { work: 2, inbox: 1 } }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, params?: Record<string, unknown>) => (params?.tag ? `${key}:${params.tag}` : key),
}));

describe("TagPickerDialog", () => {
  it("appends a known tag to markdown when checked", () => {
    const onContentChange = vi.fn();
    render(<TagPickerDialog open content="hello" onOpenChange={() => undefined} onContentChange={onContentChange} />);

    fireEvent.click(screen.getByRole("button", { name: "#inbox" }));
    expect(onContentChange).toHaveBeenCalledWith("hello #inbox");
  });

  it("removes a selected tag when unchecked", () => {
    const onContentChange = vi.fn();
    render(<TagPickerDialog open content="hello #inbox" onOpenChange={() => undefined} onContentChange={onContentChange} />);

    fireEvent.click(screen.getByRole("button", { name: "#inbox" }));
    expect(onContentChange).toHaveBeenCalledWith("hello");
  });

  it("creates a new tag from the search box", () => {
    const onContentChange = vi.fn();
    render(<TagPickerDialog open content="" onOpenChange={() => undefined} onContentChange={onContentChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "later" } });
    fireEvent.click(screen.getByRole("button", { name: "editor.tag-picker.create:later" }));
    expect(onContentChange).toHaveBeenCalledWith("#later");
  });
});
