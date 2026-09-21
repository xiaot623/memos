import { afterEach, describe, expect, it } from "vitest";
import { extractHeadings } from "@/components/MemoContent/pipeline";
import { mountRuntime } from "./markdown-runtime-harness";

describe("extractHeadings", () => {
  it("maps outline headings to unique readable fragments", () => {
    expect(extractHeadings("# 第一节：概述")[0]?.slug).toBe("第一节概述");
    expect(extractHeadings("# API 使用说明")[0]?.slug).toBe("api-使用说明");
    expect(extractHeadings("# # ?")[0]?.slug).toBe("heading");
    expect(extractHeadings("# Foo\n\n##### Foo\n\n# Foo").map((heading) => heading.slug)).toEqual(["foo", "foo-2"]);
  });
});

describe("heading DOM ids", () => {
  const runtimes: Array<{ cleanup: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.cleanup()));
  });

  it("stamps outline fragments onto matching h1–h4", async () => {
    const markdown = `# API 使用说明

## 第一节：概述

##### Foo

## 第一节：概述

# Foo
`;
    const runtime = await mountRuntime(markdown);
    runtimes.push(runtime);

    const headings = extractHeadings(markdown);
    expect(headings.map((heading) => heading.slug)).toEqual(["api-使用说明", "第一节概述", "第一节概述-1", "foo-1"]);

    for (const heading of headings) {
      const el = document.getElementById(heading.slug);
      expect(el, heading.slug).not.toBeNull();
      expect(el?.tagName).toMatch(/^H[1-4]$/);
      expect(el?.textContent).toContain(heading.text);
    }
  });

  it("does not serialize heading ids back into markdown", async () => {
    const runtime = await mountRuntime("# Title\n\nBody", "edit");
    runtimes.push(runtime);
    expect(document.getElementById("title")).not.toBeNull();
    expect(runtime.crepe.getMarkdown()).not.toMatch(/\{#title\}/);
  });
});
