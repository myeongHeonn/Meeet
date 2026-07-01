// 칸별 가능 인원/명단 집계(FR-8). DB 무관 순수 함수 — queries.ts가 내려준 raw 행을 받아
// 히트맵 렌더에 쓸 형태로 가공한다. 농도(가능 인원/전체 응답자) 계산은 표시 단계에서 한다.

export interface ParticipantRow {
  id: string;
  name: string;
}

export interface AvailabilityRow {
  participantId: string;
  pollSlotId: string;
}

export interface SlotTally {
  count: number;
  names: string[]; // 가나다/알파벳 순
}

export interface Heatmap {
  totalParticipants: number; // 빈 응답(전부 불가능)도 응답으로 카운트
  bySlot: Map<string, SlotTally>; // pollSlotId -> tally
}

export function aggregateHeatmap(
  participants: ParticipantRow[],
  availabilities: AvailabilityRow[],
): Heatmap {
  const nameById = new Map(participants.map((p) => [p.id, p.name]));
  const bySlot = new Map<string, SlotTally>();

  for (const row of availabilities) {
    const name = nameById.get(row.participantId);
    if (name === undefined) continue; // 고아 행 방어(참가자 없는 availability)
    const tally = bySlot.get(row.pollSlotId) ?? { count: 0, names: [] };
    tally.names.push(name);
    tally.count = tally.names.length;
    bySlot.set(row.pollSlotId, tally);
  }

  for (const tally of bySlot.values()) {
    tally.names.sort((a, b) => a.localeCompare(b));
  }

  return { totalParticipants: participants.length, bySlot };
}

export interface SlotParticipants {
  available: ParticipantRow[]; // 그 칸을 "가능"으로 칠한 참가자
  unavailable: ParticipantRow[]; // 응답했지만 그 칸을 칠하지 않은 참가자
}

// 특정 칸의 가능자/불가능자를 가른다(FR-8). 불가능은 "응답한 참가자 중 그 칸 미선택"으로,
// 아직 응답하지 않은 사람은 애초에 participants에 없으므로 어느 쪽에도 들어가지 않는다.
export function splitParticipantsBySlot(
  slotId: string,
  participants: ParticipantRow[],
  availabilities: AvailabilityRow[],
): SlotParticipants {
  const availableIds = new Set(
    availabilities
      .filter((a) => a.pollSlotId === slotId)
      .map((a) => a.participantId),
  );

  const available: ParticipantRow[] = [];
  const unavailable: ParticipantRow[] = [];
  for (const p of participants) {
    (availableIds.has(p.id) ? available : unavailable).push(p);
  }

  const byName = (a: ParticipantRow, b: ParticipantRow) =>
    a.name.localeCompare(b.name);
  available.sort(byName);
  unavailable.sort(byName);
  return { available, unavailable };
}
