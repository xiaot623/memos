import { describe, expect, it } from "vitest";
import { addTag, hasTag, listTags, normalizeTagName, removeTag } from "@/utils/tag-markdown";

describe("tag-markdown", () => {
  it("lists unique tags in document order", () => {
    expect(listTags("Hello #work and #inbox #work")).toEqual(["work", "inbox"]);
  });

  it("does not treat headings or escaped hashes as tags", () => {
    expect(listTags("# Title\n\n\\#NAS and a #real tag")).toEqual(["real"]);
  });

  it("does not list tags inside code or links", () => {
    const markdown = ["`#code`", "", "```", "#fenced", "```", "", "[#link](https://example.com/x#frag)", "", "ok #keep"].join("\n");
    expect(listTags(markdown)).toEqual(["keep"]);
  });

  it("does not treat a longer tag as a prefix match", () => {
    expect(hasTag("#tagfoo", "tag")).toBe(false);
    expect(listTags("#tagfoo")).toEqual(["tagfoo"]);
  });

  it("appends a tag at the end of a paragraph", () => {
    expect(addTag("hello", "inbox")).toBe("hello #inbox");
    expect(addTag("hello #inbox", "inbox")).toBe("hello #inbox");
  });

  it("puts a tag on its own line after a heading or table", () => {
    expect(addTag("# Title", "inbox")).toBe("# Title\n#inbox");
    expect(addTag("| a | b |\n| --- | --- |\n| 1 | 2 |", "inbox")).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |\n#inbox");
  });

  it("creates a tag-only document from empty content", () => {
    expect(addTag("", "inbox")).toBe("#inbox");
    expect(addTag("   ", "inbox")).toBe("#inbox");
  });

  it("strips a leading hash when adding from the picker", () => {
    expect(normalizeTagName("#inbox")).toBe("inbox");
    expect(addTag("note", "#inbox")).toBe("note #inbox");
  });

  it("removes a complete tag without touching a longer neighbor", () => {
    expect(removeTag("see #tag and #tagfoo", "tag")).toBe("see and #tagfoo");
    expect(removeTag("#inbox", "inbox")).toBe("");
  });

  it("does not remove a tag that only appears in a code block", () => {
    const markdown = ["```", "#secret", "```", "", "visible #keep"].join("\n");
    expect(removeTag(markdown, "secret")).toBe(markdown);
    expect(removeTag(markdown, "keep")).toBe(["```", "#secret", "```", "", "visible"].join("\n"));
  });
});
