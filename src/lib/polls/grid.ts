import { parseHHmm, zonedWallTimeToUtc } from "@/lib/datetime";
import { SLOT_MINUTES } from "@/lib/validations/poll";

export interface SlotTime {
  startsAt: Date;
  endsAt: Date;
}

export interface ExpandInput {
  dates: string[]; // "YYYY-MM-DD" (생성자 타임존 기준 날짜)
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  timeZone: string; // IANA, dates/times의 해석 기준
}

function minutesOf(hhmm: string): number {
  const { hour, minute } = parseHHmm(hhmm);
  return hour * 60 + minute;
}

// [선택 날짜 × 시간 범위]를 30분 격자 칸(UTC)으로 펼친다(FR-3).
// 각 칸은 생성자 타임존의 벽시계 시각을 UTC로 변환해 만든다(FR-12).
// 입력은 createPollSchema를 통과한 값으로 가정한다(시간 30분 단위, end > start).
export function expandSlots(input: ExpandInput): SlotTime[] {
  const startMin = minutesOf(input.startTime);
  const endMin = minutesOf(input.endTime);
  const slots: SlotTime[] = [];

  for (const date of input.dates) {
    const [year, month, day] = date.split("-").map(Number);
    for (let mins = startMin; mins < endMin; mins += SLOT_MINUTES) {
      const hour = Math.floor(mins / 60);
      const minute = mins % 60;
      const startsAt = zonedWallTimeToUtc(year, month, day, hour, minute, input.timeZone);
      const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60_000);
      slots.push({ startsAt, endsAt });
    }
  }

  return slots;
}
