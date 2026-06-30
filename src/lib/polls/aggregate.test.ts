import { aggregateHeatmap } from "./aggregate";

describe("aggregateHeatmap", () => {
  it("returns empty heatmap with no participants", () => {
    const h = aggregateHeatmap([], []);
    expect(h.totalParticipants).toBe(0);
    expect(h.bySlot.size).toBe(0);
  });

  it("counts availability per slot with sorted names", () => {
    const participants = [
      { id: "p1", name: "철수" },
      { id: "p2", name: "영희" },
      { id: "p3", name: "민수" },
    ];
    const availabilities = [
      { participantId: "p1", pollSlotId: "s1" },
      { participantId: "p2", pollSlotId: "s1" },
      { participantId: "p3", pollSlotId: "s1" },
      { participantId: "p2", pollSlotId: "s2" },
    ];
    const h = aggregateHeatmap(participants, availabilities);

    expect(h.totalParticipants).toBe(3);
    expect(h.bySlot.get("s1")).toEqual({
      count: 3,
      names: ["민수", "영희", "철수"], // localeCompare 정렬
    });
    expect(h.bySlot.get("s2")).toEqual({ count: 1, names: ["영희"] });
  });

  it("counts a participant with no selections toward the total only", () => {
    const participants = [
      { id: "p1", name: "철수" },
      { id: "p2", name: "영희" }, // 아무 칸도 안 칠함
    ];
    const availabilities = [{ participantId: "p1", pollSlotId: "s1" }];
    const h = aggregateHeatmap(participants, availabilities);

    expect(h.totalParticipants).toBe(2);
    expect(h.bySlot.get("s1")?.count).toBe(1);
  });

  it("ignores orphan availability rows (participant not present)", () => {
    const h = aggregateHeatmap(
      [{ id: "p1", name: "철수" }],
      [{ participantId: "ghost", pollSlotId: "s1" }],
    );
    expect(h.bySlot.size).toBe(0);
  });
});
