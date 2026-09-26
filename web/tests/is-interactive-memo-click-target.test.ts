import { describe, expect, it } from "vitest";
import { isInteractiveMemoClickTarget, isMemoCardSurfaceClick } from "@/components/MemoView/isInteractiveMemoClickTarget";

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
    expect(fire('<span data-slot="memo-goto-detail">8 minutes ago</span>', "[data-slot='memo-goto-detail']")).toBe(true);
    expect(fire('<span data-slot="memo-goto-detail"><relative-time>8 minutes ago</relative-time></span>', "relative-time")).toBe(true);
  });

  it("walks out of a text node inside a control", () => {
    const root = document.createElement("article");
    const button = document.createElement("button");
    button.textContent = "Edit";
    root.append(button);
    expect(isInteractiveMemoClickTarget(button.firstChild)).toBe(true);
  });

  it("opens the editor only for clicks on the card surface", () => {
    const card = document.createElement("article");
    const body = document.createElement("p");
    body.textContent = "note";
    card.append(body);
    const option = document.createElement("div");
    option.setAttribute("role", "option");
    option.textContent = "Space";
    document.body.append(card, option);

    expect(isMemoCardSurfaceClick({ currentTarget: card, target: body })).toBe(true);
    expect(isMemoCardSurfaceClick({ currentTarget: card, target: option })).toBe(false);

    card.remove();
    option.remove();
  });
});
