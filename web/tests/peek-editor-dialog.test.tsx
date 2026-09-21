import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PeekEditorDialog } from "@/components/MemoEditor/components/PeekEditorDialog";
import { PEEK_MORPH_EASING, PEEK_MORPH_MS, PEEK_PRESENCE_MS } from "@/components/MemoEditor/constants";

function getPeekShell(): HTMLElement {
  return document.querySelector("[data-slot='memo-peek-shell']") as HTMLElement;
}

function mockShellBox(shell: HTMLElement) {
  Object.defineProperty(shell, "offsetWidth", {
    configurable: true,
    get() {
      return shell.className.includes("max-w-5xl") ? 960 : 512;
    },
  });
  Object.defineProperty(shell, "offsetHeight", {
    configurable: true,
    get() {
      return shell.className.includes("max-w-5xl") ? 800 : 240;
    },
  });
}

describe("<PeekEditorDialog>", () => {
  it("calls onDismiss when Escape is pressed", async () => {
    const onDismiss = vi.fn();
    render(
      <PeekEditorDialog isFocusMode={false} title="Edit memo" onDismiss={onDismiss}>
        <div>editor card</div>
      </PeekEditorDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit memo" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });

  it("dismisses a focused peek when the backdrop is clicked", async () => {
    const onDismiss = vi.fn();
    render(
      <PeekEditorDialog isFocusMode={true} title="Edit memo" onDismiss={onDismiss}>
        <div>editor card</div>
      </PeekEditorDialog>,
    );

    fireEvent.click(document.querySelector("[data-slot='memo-peek-backdrop']") as HTMLElement);
    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });

  it("enters and exits with the same center-origin presence motion as the size morph", () => {
    render(
      <PeekEditorDialog isFocusMode={false} title="Edit memo" onDismiss={() => {}}>
        <div>editor card</div>
      </PeekEditorDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit memo" });
    const backdrop = document.querySelector("[data-slot='memo-peek-backdrop']") as HTMLElement;
    expect(dialog.className).toContain("origin-center");
    expect(dialog.className).toContain(`duration-[${PEEK_PRESENCE_MS}ms]`);
    expect(dialog.className).toContain("cubic-bezier(0.32,0.72,0,1)");
    expect(dialog.className).toContain("data-starting-style:scale-[0.96]");
    expect(backdrop.className).toContain(`duration-[${PEEK_PRESENCE_MS}ms]`);
    expect(backdrop.className).toContain("data-starting-style:opacity-0");
  });

  it("keeps a centered overlay and morphs the same shell between compact and expanded sizes", () => {
    const { rerender } = render(
      <PeekEditorDialog isFocusMode={false} title="Edit memo" onDismiss={() => {}}>
        <div>editor card</div>
      </PeekEditorDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit memo" });
    const shell = getPeekShell();
    expect(dialog.className).toContain("-translate-x-1/2");
    expect(shell).toHaveAttribute("data-state", "compact");
    expect(shell.className).toContain("max-w-lg");
    expect(shell.className).not.toContain("max-w-5xl");

    mockShellBox(shell);
    rerender(
      <PeekEditorDialog isFocusMode={true} title="Edit memo" onDismiss={() => {}}>
        <div>editor card</div>
      </PeekEditorDialog>,
    );

    expect(screen.getByRole("dialog", { name: "Edit memo" }).className).toContain("-translate-x-1/2");
    expect(shell).toHaveAttribute("data-state", "expanded");
    expect(shell.className).toContain("max-w-5xl");
    expect(shell.style.width).toBe("960px");
    expect(shell.style.height).toBe("800px");
    expect(shell.style.transition).toContain(`${PEEK_MORPH_MS}ms`);
    expect(shell.style.transition).toContain(PEEK_MORPH_EASING);
  });
});
