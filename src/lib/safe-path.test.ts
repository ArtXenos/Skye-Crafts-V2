import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-path";

describe("safeNextPath", () => {
  it.each(["/checkout", "/account/orders/12?placed=1", "/products#reviews"])("keeps the site path %j", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/%09/evil.example".replace("%09", "\t"),
    "evil.example",
    "javascript:alert(1)",
    "",
    "/" + "a".repeat(600),
  ])("rejects %j", (path) => {
    expect(safeNextPath(path)).toBe("/account");
  });

  it("rejects non-strings", () => {
    expect(safeNextPath(undefined, "/")).toBe("/");
    expect(safeNextPath(["/checkout"])).toBe("/account");
  });

  it("never returns something a browser would read as another site", () => {
    for (const path of ["/\t/evil.example", "/ /evil.example", "/./evil.example"]) {
      const result = safeNextPath(path);
      expect(new URL(result, "https://shop.example").origin).toBe("https://shop.example");
    }
  });
});
