import { computeExpiresAt } from "./expiry";

describe("computeExpiresAt", () => {
  it("returns midnight 7 days after the day after the last date, in the creator timezone", () => {
    // 마지막 날짜 2026-07-12 → 다음날 07-13 + 7일 = 07-20 00:00 KST = 2026-07-19T15:00:00Z.
    expect(computeExpiresAt(["2026-07-12"], "Asia/Seoul").toISOString()).toBe(
      "2026-07-19T15:00:00.000Z",
    );
  });

  it("uses the last (max) date when several are given", () => {
    expect(
      computeExpiresAt(["2026-07-10", "2026-07-11", "2026-07-12"], "Asia/Seoul").toISOString(),
    ).toBe("2026-07-19T15:00:00.000Z");
  });

  it("rolls over month/year boundaries", () => {
    // 2026-07-28 → 08-05 00:00 KST = 2026-08-04T15:00:00Z (유예 기간이 월을 넘어감).
    expect(computeExpiresAt(["2026-07-28"], "Asia/Seoul").toISOString()).toBe(
      "2026-08-04T15:00:00.000Z",
    );
    // 2026-12-31 → 2027-01-08 00:00 KST = 2027-01-07T15:00:00Z.
    expect(computeExpiresAt(["2026-12-31"], "Asia/Seoul").toISOString()).toBe(
      "2027-01-07T15:00:00.000Z",
    );
  });

  it("computes in UTC when the creator timezone is UTC", () => {
    expect(computeExpiresAt(["2026-07-12"], "UTC").toISOString()).toBe(
      "2026-07-20T00:00:00.000Z",
    );
  });
});
