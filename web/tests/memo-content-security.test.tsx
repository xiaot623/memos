import type { Node } from "@milkdown/kit/prose/model";
import { afterEach, describe, expect, it } from "vitest";
import { htmlToDOM } from "@/components/MarkdownRuntime/plugins/html";
import { isTrustedIframeSrc } from "@/components/MemoContent/constants";
import { mountRuntime } from "./markdown-runtime-harness";

const asHtmlNode = (value: string) => ({ attrs: { value } }) as unknown as Node;

describe("trusted HTML in the Milkdown runtime", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("renders trusted iframes and drops untrusted HTML from the visual tree", () => {
    const trusted = htmlToDOM(asHtmlNode('<iframe src="https://www.youtube.com/embed/abc123" title="demo"></iframe>'));
    expect(trusted[0]).toBe("iframe");
    expect(trusted[1].src).toBe("https://www.youtube.com/embed/abc123");

    const untrusted = htmlToDOM(asHtmlNode('<iframe src="https://evil.example/embed/abc123" title="demo"></iframe>'));
    expect(untrusted[0]).toBe("span");
    expect(untrusted[1].hidden).toBe("true");

    const styled = htmlToDOM(asHtmlNode('<span style="position:fixed;inset:0;z-index:99999">overlay</span>'));
    expect(styled[0]).toBe("span");
    expect(styled[1].hidden).toBe("true");
    expect(styled[1]).not.toHaveProperty("style");
  });

  it("renders a trusted iframe in the live editor", async () => {
    const runtime = await mountRuntime('<iframe src="https://www.youtube.com/embed/abc123" title="demo"></iframe>');
    runtimes.push(runtime);
    const iframe = runtime.root.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute("src", "https://www.youtube.com/embed/abc123");
  });
});

describe("trusted iframe providers", () => {
  it("accepts trusted providers only", () => {
    expect(isTrustedIframeSrc("https://www.youtube.com/embed/abc123")).toBe(true);
    expect(isTrustedIframeSrc("https://www.youtube-nocookie.com/embed/abc123?si=test")).toBe(true);
    expect(isTrustedIframeSrc("https://player.vimeo.com/video/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://open.spotify.com/embed/track/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://www.loom.com/embed/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://www.google.com/maps/embed?pb=test")).toBe(true);
    expect(isTrustedIframeSrc("https://app.diagrams.net/?embed=1")).toBe(true);
    expect(isTrustedIframeSrc("https://www.draw.io/?embed=1")).toBe(true);
    expect(isTrustedIframeSrc("https://evil.example/embed/abc123")).toBe(false);
  });
});
