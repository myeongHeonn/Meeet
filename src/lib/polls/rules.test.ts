import { allSlotsBelongToPoll, isPollExpired } from "./rules";

describe("allSlotsBelongToPoll", () => {
  const pollSlots = ["s1", "s2", "s3"];

  it("is true when every requested slot belongs to the poll", () => {
    expect(allSlotsBelongToPoll(["s1", "s3"], pollSlots)).toBe(true);
  });

  it("is true for an empty request", () => {
    expect(allSlotsBelongToPoll([], pollSlots)).toBe(true);
  });

  it("is false when a requested slot is not in the poll", () => {
    expect(allSlotsBelongToPoll(["s1", "x9"], pollSlots)).toBe(false);
  });

  it("accepts a Set as the poll slot collection", () => {
    expect(allSlotsBelongToPoll(["s2"], new Set(pollSlots))).toBe(true);
  });
});

describe("isPollExpired", () => {
  const now = new Date("2026-07-13T00:00:00.000Z");

  it("is false when expiry is in the future", () => {
    expect(isPollExpired(new Date("2026-07-13T00:00:01.000Z"), now)).toBe(false);
  });

  it("is true when expiry is in the past", () => {
    expect(isPollExpired(new Date("2026-07-12T23:59:59.000Z"), now)).toBe(true);
  });

  it("is true at the exact boundary (expiry == now)", () => {
    expect(isPollExpired(new Date("2026-07-13T00:00:00.000Z"), now)).toBe(true);
  });
});
