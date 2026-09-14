import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useMarkdownViewClicks } from "@/components/MarkdownRuntime/interaction";
import { mountRuntime } from "./markdown-runtime-harness";

const FOOTNOTE_MARKDOWN = "A statement with a note.[^1]\n\n[^1]: The footnote body.";

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.hash}`}</output>;
};

const ClickRoot = ({ compact, html }: { compact?: boolean; html: string }) => {
  const onClick = useMarkdownViewClicks({ compact, memoName: "memos/abc123" });
  return (
    <div
      data-memo-content
      onClick={onClick}
      // The runtime HTML is produced by Milkdown; this harness only exercises click routing.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

describe("memo footnotes", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    if (!globalThis.CSS) {
      Object.defineProperty(globalThis, "CSS", { configurable: true, value: {} });
    }
    if (!globalThis.CSS.escape) {
      globalThis.CSS.escape = (value: string) => value;
    }
  });

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("keeps GFM footnote references aligned with their target ids", async () => {
    const runtime = await mountRuntime(FOOTNOTE_MARKDOWN);
    runtimes.push(runtime);

    const reference = runtime.root.querySelector<HTMLAnchorElement>("a[data-footnote-ref]");
    const target = runtime.root.querySelector<HTMLElement>("#user-content-fn-1");

    expect(reference).not.toBeNull();
    expect(reference).toHaveAttribute("href", "#user-content-fn-1");
    expect(target).not.toBeNull();
    expect(runtime.root.querySelector("#user-content-user-content-fn-1")).toBeNull();
  });

  it("scrolls to a footnote inside the same fully rendered memo", async () => {
    const runtime = await mountRuntime(FOOTNOTE_MARKDOWN);
    const html = runtime.root.innerHTML;
    await runtime.cleanup();
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ClickRoot html={html} />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const reference = container.querySelector<HTMLAnchorElement>("a[data-footnote-ref]");
    const target = container.querySelector<HTMLElement>("#user-content-fn-1");
    expect(reference).not.toBeNull();
    expect(target).not.toBeNull();
    const scrollIntoView = vi.fn();
    target!.scrollIntoView = scrollIntoView;

    fireEvent.click(reference!);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("navigates compact cards to the memo detail footnote", async () => {
    const runtime = await mountRuntime(FOOTNOTE_MARKDOWN);
    const html = runtime.root.innerHTML;
    await runtime.cleanup();
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ClickRoot compact html={html} />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const reference = container.querySelector<HTMLAnchorElement>("a[data-footnote-ref]");
    expect(reference).not.toBeNull();

    fireEvent.click(reference!);

    expect(screen.getByTestId("location")).toHaveTextContent("/memos/abc123#user-content-fn-1");
  });
});
