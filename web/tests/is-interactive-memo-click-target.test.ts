import { describe, expect, it } from "vitest";
import { isInteractiveMemoClickTarget } from "@/components/MemoView/isInteractiveMemoClickTarget";

const fire = (html: string, selector?: string): boolean => {
  const root = document.createElement("article");
  root.innerHTML = html;
  document.body.append(root);
  const target = selector ? root.querySelector(selector) : root;
  const result = isInteractiveMemoClickTarget(target);
  root.remove();
  return result;
};

describe("isInteractiveMemoClickTarget", () => {
  it("ignores the card surface itself", () => {
    expect(fire("<p>note body</p>")).toBe(false);
  });

  it("treats buttons, links, images, tags, and checkboxes as interactive", () => {
    expect(fire('<button type="button">More</button>', "button")).toBe(true);
    expect(fire('<a href="/memos/1">link</a>', "a")).toBe(true);
    expect(fire('<img src="/x.png" alt="">', "img")).toBe(true);
    expect(fire('<span data-tag="inbox">#inbox</span>', "[data-tag]")).toBe(true);
    expect(fire('<button data-slot="checkbox"></button>', "[data-slot='checkbox']")).toBe(true);
  });

  it("walks out of a text node inside a control", () => {
    const root = document.createElement("article");
    const button = document.createElement("button");
    button.textContent = "Edit";
    root.append(button);
    expect(isInteractiveMemoClickTarget(button.firstChild)).toBe(true);
  });
});
