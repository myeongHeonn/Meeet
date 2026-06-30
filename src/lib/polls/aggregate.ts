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
