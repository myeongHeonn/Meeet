import { buildGridLayout, cellKey } from "./layout";

describe("buildGridLayout", () => {
  it("arranges slots into date columns and time rows (Seoul)", () => {
    // 2026-07-30 09:00, 09:30 KST and 2026-07-31 09:00 KST
    const slots = [
      { id: "a", startsAt: "2026-07-30T00:00:00.000Z" }, // 09:00 KST 7/30
      { id: "b", startsAt: "2026-07-30T00:30:00.000Z" }, // 09:30 KST 7/30
      { id: "c", startsAt: "2026-07-30T15:00:00.000Z" }, // 00:00 KST 7/31
    ];
    const layout = buildGridLayout(slots, "Asia/Seoul");

    expect(layout.dateKeys).toEqual(["2026-07-30", "2026-07-31"]);
    expect(layout.timeKeys).toEqual(["00:00", "09:00", "09:30"]);
    expect(layout.cell.get(cellKey("2026-07-30", "09:00"))).toBe("a");
    expect(layout.cell.get(cellKey("2026-07-30", "09:30"))).toBe("b");
    expect(layout.cell.get(cellKey("2026-07-31", "00:00"))).toBe("c");
  });

  it("re-buckets across midnight when viewed from another timezone", () => {
    // 2026-07-30 23:00 UTC = 2026-07-31 08:00 in Seoul.
    const slots = [{ id: "x", startsAt: "2026-07-30T23:00:00.000Z" }];
    const layout = buildGridLayout(slots, "Asia/Seoul");
    expect(layout.dateKeys).toEqual(["2026-07-31"]);
    expect(layout.cell.get(cellKey("2026-07-31", "08:00"))).toBe("x");
  });

  it("returns empty structures for no slots", () => {
    const layout = buildGridLayout([], "UTC");
    expect(layout.dateKeys).toEqual([]);
    expect(layout.timeKeys).toEqual([]);
    expect(layout.cell.size).toBe(0);
  });
});
