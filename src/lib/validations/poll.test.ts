import { createPollSchema, submitResponseSchema, MAX_DATES } from "./poll";

// 항상 미래인 날짜를 만들어 "과거 날짜 거부" refine에 걸리지 않게 한다.
const FUTURE_YEAR = new Date().getUTCFullYear() + 1;
const futureDate = (mmdd: string) => `${FUTURE_YEAR}-${mmdd}`;

const validCreate = {
  title: "팀 회식",
  description: "다음 달 중에",
  dates: [futureDate("07-30"), futureDate("07-31")],
  startTime: "09:00",
  endTime: "17:00",
  timeZone: "Asia/Seoul",
};

describe("createPollSchema", () => {
  it("accepts a valid payload", () => {
    const r = createPollSchema.safeParse(validCreate);
    expect(r.success).toBe(true);
  });

  it("trims title and rejects empty title", () => {
    expect(createPollSchema.safeParse({ ...validCreate, title: "   " }).success).toBe(
      false,
    );
  });

  it("rejects zero dates", () => {
    expect(createPollSchema.safeParse({ ...validCreate, dates: [] }).success).toBe(
      false,
    );
  });

  it("rejects an invalid calendar date (Feb 30)", () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, dates: [futureDate("02-30")] })
        .success,
    ).toBe(false);
  });

  it("dedupes and sorts dates", () => {
    const r = createPollSchema.parse({
      ...validCreate,
      dates: [futureDate("07-31"), futureDate("07-30"), futureDate("07-31")],
    });
    expect(r.dates).toEqual([futureDate("07-30"), futureDate("07-31")]);
  });

  it("rejects endTime <= startTime", () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, startTime: "17:00", endTime: "09:00" })
        .success,
    ).toBe(false);
  });

  it("rejects non-30-min times", () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, startTime: "09:20" }).success,
    ).toBe(false);
  });

  it("rejects past dates", () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, dates: ["2000-01-01"] }).success,
    ).toBe(false);
  });

  it("rejects more than MAX_DATES dates", () => {
    const many = Array.from({ length: MAX_DATES + 1 }, (_, i) => {
      const day = pad(i + 1);
      return `${FUTURE_YEAR}-01-${day}`;
    });
    expect(createPollSchema.safeParse({ ...validCreate, dates: many }).success).toBe(
      false,
    );
  });

  it("accepts a single full day (47 cells)", () => {
    const r = createPollSchema.safeParse({
      ...validCreate,
      dates: [futureDate("07-30")],
      startTime: "00:00",
      endTime: "23:30",
    });
    expect(r.success).toBe(true); // 47 cells, under the cap
  });

  it("rejects a grid that exceeds the cell cap (31 days × full day = 1457)", () => {
    const dates = Array.from(
      { length: 31 },
      (_, i) => `${FUTURE_YEAR}-01-${pad(i + 1)}`,
    );
    const r = createPollSchema.safeParse({
      ...validCreate,
      dates,
      startTime: "00:00",
      endTime: "23:30",
    });
    expect(r.success).toBe(false); // 31 × 47 = 1457 > MAX_CELLS (1000)
  });

  it("rejects an invalid timezone", () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, timeZone: "Mars/Phobos" }).success,
    ).toBe(false);
  });
});

describe("submitResponseSchema", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";
  const uuid2 = "22222222-2222-4222-8222-222222222222";

  it("accepts name with available slots", () => {
    const r = submitResponseSchema.parse({ name: "민허", availableSlotIds: [uuid] });
    expect(r.availableSlotIds).toEqual([uuid]);
  });

  it("allows an empty selection (all unavailable is still a response)", () => {
    expect(
      submitResponseSchema.safeParse({ name: "민허", availableSlotIds: [] }).success,
    ).toBe(true);
  });

  it("dedupes slot ids", () => {
    const r = submitResponseSchema.parse({
      name: "민허",
      availableSlotIds: [uuid, uuid, uuid2],
    });
    expect(r.availableSlotIds).toEqual([uuid, uuid2]);
  });

  it("rejects empty name", () => {
    expect(
      submitResponseSchema.safeParse({ name: "  ", availableSlotIds: [] }).success,
    ).toBe(false);
  });

  it("rejects non-uuid slot ids", () => {
    expect(
      submitResponseSchema.safeParse({ name: "민허", availableSlotIds: ["nope"] })
        .success,
    ).toBe(false);
  });

  it("accepts an optional editToken", () => {
    const r = submitResponseSchema.safeParse({
      name: "민허",
      availableSlotIds: [uuid],
      editToken: uuid2,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-uuid editToken", () => {
    expect(
      submitResponseSchema.safeParse({
        name: "민허",
        availableSlotIds: [],
        editToken: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
