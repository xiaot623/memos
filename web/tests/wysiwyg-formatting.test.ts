import { describe, expect, it } from "vitest";
import { EMPTY_ACTIVE_FORMATS } from "@/components/MemoEditor/formatting/commands";
import { createWysiwygFormattingController } from "@/components/MemoEditor/Wysiwyg/formatting";

describe("createWysiwygFormattingController", () => {
  it("returns empty active formats until a Milkdown ctx exists", () => {
    const formatting = createWysiwygFormattingController(() => undefined, new Set());
    expect(formatting.getActiveFormats()).toEqual(EMPTY_ACTIVE_FORMATS);
  });

  it("is a no-op when running commands without a ctx", () => {
    const formatting = createWysiwygFormattingController(() => undefined, new Set());
    expect(() => formatting.run("bold")).not.toThrow();
  });
});
