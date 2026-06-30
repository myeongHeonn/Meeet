import { allSlotsBelongToPoll, canRespond, canConfirm } from "./rules";

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

describe("canRespond / canConfirm", () => {
  it("allow actions only when open", () => {
    expect(canRespond("open")).toBe(true);
    expect(canConfirm("open")).toBe(true);
  });

  it("block actions when confirmed", () => {
    expect(canRespond("confirmed")).toBe(false);
    expect(canConfirm("confirmed")).toBe(false);
  });
});
