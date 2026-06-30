import { getZonedParts } from "@/lib/datetime";

export interface LayoutSlot {
  id: string;
  startsAt: string; // ISO UTC
}

export interface GridLayout {
  dateKeys: string[]; // "YYYY-MM-DD" (뷰어 타임존 기준), 오름차순
  timeKeys: string[]; // "HH:mm" (뷰어 타임존 기준), 오름차순
  cell: Map<string, string>; // `${dateKey}__${timeKey}` -> slotId
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function cellKey(dateKey: string, timeKey: string): string {
  return `${dateKey}__${timeKey}`;
}

// UTC 슬롯들을 뷰어 타임존 기준으로 (날짜 열 × 시간 행) 격자로 재구성한다(FR-12, design 구현노트).
// 뷰어 타임존이 다르면 같은 폴도 행/열이 다르게 나뉜다(자정 부근 칸이 다음 날로 넘어감).
export function buildGridLayout(
  slots: LayoutSlot[],
  timeZone: string,
): GridLayout {
  const dateKeys = new Set<string>();
  const timeKeys = new Set<string>();
  const cell = new Map<string, string>();

  for (const slot of slots) {
    const p = getZonedParts(new Date(slot.startsAt), timeZone);
    const dateKey = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
    const timeKey = `${pad2(p.hour)}:${pad2(p.minute)}`;
    dateKeys.add(dateKey);
    timeKeys.add(timeKey);
    cell.set(cellKey(dateKey, timeKey), slot.id);
  }

  return {
    dateKeys: [...dateKeys].sort(),
    timeKeys: [...timeKeys].sort(),
    cell,
  };
}
