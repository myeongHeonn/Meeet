import { getZonedParts, zonedWallTimeToUtc, parseHHmm } from "./datetime";

describe("zonedWallTimeToUtc", () => {
  it("converts a UTC+9 (Asia/Seoul, no DST) wall time to UTC", () => {
    // 2026-07-30 09:00 KST === 2026-07-30 00:00 UTC
    const utc = zonedWallTimeToUtc(2026, 7, 30, 9, 0, "Asia/Seoul");
    expect(utc.toISOString()).toBe("2026-07-30T00:00:00.000Z");
  });

  it("is identity for UTC", () => {
    const utc = zonedWallTimeToUtc(2026, 7, 30, 9, 0, "UTC");
    expect(utc.toISOString()).toBe("2026-07-30T09:00:00.000Z");
  });

  it("respects DST (America/New_York is EDT/UTC-4 in July)", () => {
    // 2026-07-30 09:00 EDT === 2026-07-30 13:00 UTC
    const utc = zonedWallTimeToUtc(2026, 7, 30, 9, 0, "America/New_York");
    expect(utc.toISOString()).toBe("2026-07-30T13:00:00.000Z");
  });

  it("respects standard time (America/New_York is EST/UTC-5 in January)", () => {
    // 2026-01-15 09:00 EST === 2026-01-15 14:00 UTC
    const utc = zonedWallTimeToUtc(2026, 1, 15, 9, 0, "America/New_York");
    expect(utc.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("handles a half-hour offset zone (Asia/Kolkata, UTC+5:30)", () => {
    // 2026-07-30 09:00 IST === 2026-07-30 03:30 UTC
    const utc = zonedWallTimeToUtc(2026, 7, 30, 9, 0, "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-07-30T03:30:00.000Z");
  });
});

describe("getZonedParts", () => {
  it("decomposes a UTC instant into Seoul wall time", () => {
    const p = getZonedParts(new Date("2026-07-30T00:00:00.000Z"), "Asia/Seoul");
    expect(p).toMatchObject({ year: 2026, month: 7, day: 30, hour: 9, minute: 0 });
  });

  it("round-trips with zonedWallTimeToUtc", () => {
    const utc = zonedWallTimeToUtc(2026, 12, 31, 23, 30, "America/New_York");
    const p = getZonedParts(utc, "America/New_York");
    expect(p).toMatchObject({
      year: 2026,
      month: 12,
      day: 31,
      hour: 23,
      minute: 30,
    });
  });

  it("crosses to the next day in a more eastern zone", () => {
    // 2026-07-30 23:00 UTC is already 2026-07-31 08:00 in Seoul.
    const p = getZonedParts(new Date("2026-07-30T23:00:00.000Z"), "Asia/Seoul");
    expect(p).toMatchObject({ year: 2026, month: 7, day: 31, hour: 8 });
  });
});

describe("parseHHmm", () => {
  it("parses hour and minute", () => {
    expect(parseHHmm("09:30")).toEqual({ hour: 9, minute: 30 });
    expect(parseHHmm("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(parseHHmm("23:30")).toEqual({ hour: 23, minute: 30 });
  });
});
