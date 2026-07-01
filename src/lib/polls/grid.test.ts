import { expandSlots } from "./grid";

describe("expandSlots", () => {
  it("expands one day × 9:00–17:00 into 16 half-hour slots", () => {
    const slots = expandSlots({
      dates: ["2026-07-30"],
      startTime: "09:00",
      endTime: "17:00",
      timeZone: "Asia/Seoul",
    });
    expect(slots).toHaveLength(16); // 8 hours × 2

    // First slot: 2026-07-30 09:00 KST = 00:00 UTC, 30-min long.
    expect(slots[0].startsAt.toISOString()).toBe("2026-07-30T00:00:00.000Z");
    expect(slots[0].endsAt.toISOString()).toBe("2026-07-30T00:30:00.000Z");

    // Last slot starts at 16:30 KST = 07:30 UTC.
    expect(slots[15].startsAt.toISOString()).toBe("2026-07-30T07:30:00.000Z");
    expect(slots[15].endsAt.toISOString()).toBe("2026-07-30T08:00:00.000Z");
  });

  it("expands up to a 24:00 end, last slot 23:30–24:00", () => {
    const slots = expandSlots({
      dates: ["2026-07-30"],
      startTime: "23:00",
      endTime: "24:00",
      timeZone: "Asia/Seoul",
    });
    expect(slots).toHaveLength(2); // 23:00–23:30, 23:30–24:00
    // Last slot: 2026-07-30 23:30 KST = 14:30 UTC, ends at 15:00 UTC (= 00:00 KST next day).
    expect(slots[1].startsAt.toISOString()).toBe("2026-07-30T14:30:00.000Z");
    expect(slots[1].endsAt.toISOString()).toBe("2026-07-30T15:00:00.000Z");
  });

  it("multiplies slots across multiple dates", () => {
    const slots = expandSlots({
      dates: ["2026-07-30", "2026-07-31"],
      startTime: "09:00",
      endTime: "10:00",
      timeZone: "UTC",
    });
    expect(slots).toHaveLength(4); // 2 days × 2 cells
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      "2026-07-30T09:00:00.000Z",
      "2026-07-30T09:30:00.000Z",
      "2026-07-31T09:00:00.000Z",
      "2026-07-31T09:30:00.000Z",
    ]);
  });

  it("every slot is exactly 30 minutes", () => {
    const slots = expandSlots({
      dates: ["2026-07-30"],
      startTime: "09:00",
      endTime: "12:00",
      timeZone: "America/New_York",
    });
    for (const s of slots) {
      expect(s.endsAt.getTime() - s.startsAt.getTime()).toBe(30 * 60_000);
    }
  });

  it("converts wall time using the given timezone (EDT in July)", () => {
    const slots = expandSlots({
      dates: ["2026-07-30"],
      startTime: "09:00",
      endTime: "09:30",
      timeZone: "America/New_York",
    });
    // 09:00 EDT (UTC-4) = 13:00 UTC
    expect(slots[0].startsAt.toISOString()).toBe("2026-07-30T13:00:00.000Z");
  });
});
