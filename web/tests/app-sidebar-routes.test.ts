import { describe, expect, it } from "vitest";
import { getRouteActionPolicy, getSidebarRouteKind } from "@/components/AppSidebar/routes";

describe("sidebar route content", () => {
  it.each([
    ["/", "home"],
    ["/archived", "archived"],
    ["/ARCHIVED/", "archived"],
    ["/attachments", "attachments"],
    ["/Attachments/", "attachments"],
    ["/setting", "settings"],
    ["/Setting/", "settings"],
    ["/memos/abc", "memo"],
    ["/Memos/ABC/", "memo"],
    ["/memos/shares/token", "memo"],
    ["/Memos/Shares/token/", "memo"],
    ["/about", "common"],
    ["/403", "common"],
    ["/404", "common"],
    ["/unknown", "common"],
    ["/explore", "common"],
    ["/u/steven", "common"],
    ["/views", "common"],
    ["/calendar", "common"],
    ["/inbox", "common"],
  ])("maps %s to %s content", (path, kind) => {
    expect(getSidebarRouteKind(path)).toBe(kind);
  });

  it("keeps search in the route collection on home", () => {
    expect(getRouteActionPolicy("/")).toEqual({
      searchScope: "route-collection",
    });
  });

  it.each(["/archived", "/ARCHIVED/"])("keeps %s in the user archive", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "user-collection",
    });
  });

  it("keeps the route scope when attachments sends search to Home", () => {
    expect(getRouteActionPolicy("/attachments")).toEqual({
      searchScope: "route-collection",
      searchDestination: "/",
    });
  });

  it.each(["/setting", "/about", "/memos/abc", "/memos/shares/token", "/403", "/404", "/unknown"])("sends search to All on %s", (path) => {
    expect(getRouteActionPolicy(path)).toEqual({
      searchScope: "all",
      searchDestination: "/",
    });
  });
});
