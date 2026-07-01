import { computeExpiresAt } from "./expiry";

describe("computeExpiresAt", () => {
  it("returns midnight of the day after the last date, in the creator timezone", () => {
    // 마지막 날짜 2026-07-12, 다음날 00:00 KST = 2026-07-12T15:00:00Z.
    expect(computeExpiresAt(["2026-07-12"], "Asia/Seoul").toISOString()).toBe(
      "2026-07-12T15:00:00.000Z",
    );
  });

  it("uses the last (max) date when several are given", () => {
    expect(
      computeExpiresAt(["2026-07-10", "2026-07-11", "2026-07-12"], "Asia/Seoul").toISOString(),
    ).toBe("2026-07-12T15:00:00.000Z");
  });

  it("rolls over month/year boundaries", () => {
    // 2026-07-31 → 다음날 2026-08-01 00:00 KST = 2026-07-31T15:00:00Z.
    expect(computeExpiresAt(["2026-07-31"], "Asia/Seoul").toISOString()).toBe(
      "2026-07-31T15:00:00.000Z",
    );
    // 2026-12-31 → 2027-01-01 00:00 KST = 2026-12-31T15:00:00Z.
    expect(computeExpiresAt(["2026-12-31"], "Asia/Seoul").toISOString()).toBe(
      "2026-12-31T15:00:00.000Z",
    );
  });

  it("computes in UTC when the creator timezone is UTC", () => {
    expect(computeExpiresAt(["2026-07-12"], "UTC").toISOString()).toBe(
      "2026-07-13T00:00:00.000Z",
    );
  });
});
