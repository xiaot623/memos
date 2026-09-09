import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PeekEditorDialog } from "@/components/MemoEditor/components/PeekEditorDialog";

describe("<PeekEditorDialog>", () => {
  it("calls onDismiss when Escape is pressed", () => {
    const onDismiss = vi.fn();
    render(
      <PeekEditorDialog isFocusMode={false} title="Edit memo" onDismiss={onDismiss}>
        <div>editor card</div>
      </PeekEditorDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit memo" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("dismisses a focused peek when the padded frame around the card is clicked", () => {
    const onDismiss = vi.fn();
    render(
      <PeekEditorDialog isFocusMode={true} title="Edit memo" onDismiss={onDismiss}>
        <div>editor card</div>
      </PeekEditorDialog>,
    );

    fireEvent.click(screen.getByRole("dialog", { name: "Edit memo" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
