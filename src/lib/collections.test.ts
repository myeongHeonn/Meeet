import { sameSet } from "./collections";

describe("sameSet", () => {
  it("is true for sets with the same items in any order", () => {
    expect(sameSet(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
    expect(sameSet(new Set(), new Set())).toBe(true);
  });

  it("is false when sizes or items differ", () => {
    expect(sameSet(new Set(["a"]), new Set(["a", "b"]))).toBe(false);
    expect(sameSet(new Set(["a", "c"]), new Set(["a", "b"]))).toBe(false);
  });
});
