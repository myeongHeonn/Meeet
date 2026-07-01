// 타임존 변환의 단일 경로(plan §7). 외부 라이브러리 없이 Intl 기반으로 구현한다.
// 핵심은 두 방향뿐이다:
//   - zonedWallTimeToUtc: 생성 시 [특정 타임존의 벽시계 시각] → UTC Date (grid.ts)
//   - getZonedParts:      표시 시 [UTC Date] → 뷰어 타임존의 연/월/일/시/분 (time-grid)

export interface ZonedParts {
  year: number;
  month: number; // 1~12
  day: number;
  hour: number; // 0~23
  minute: number;
  weekday: string; // "Mon" 등 (en-US short)
}

// 주어진 순간(UTC Date)을 특정 타임존에서 보면 벽시계로 몇 시인지 분해한다.
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  // 일부 런타임은 자정을 "24"로 반환한다 → 0으로 정규화.
  let hour = Number.parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  return {
    year: Number.parseInt(get("year"), 10),
    month: Number.parseInt(get("month"), 10),
    day: Number.parseInt(get("day"), 10),
    hour,
    minute: Number.parseInt(get("minute"), 10),
    weekday: get("weekday"),
  };
}

// 특정 타임존의 벽시계 시각(연/월/일/시/분)을 가리키는 UTC 순간을 구한다.
// UTC로 가정한 추정값을 해당 타임존에서 다시 읽어 목표 벽시계와의 차이만큼
// 보정한다. DST 경계 안정화를 위해 최대 2회 반복한다.
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const targetWallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let utc = targetWallAsUtc;
  for (let i = 0; i < 2; i++) {
    const p = getZonedParts(new Date(utc), timeZone);
    const seenWallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const diff = targetWallAsUtc - seenWallAsUtc;
    if (diff === 0) break;
    utc += diff;
  }
  return new Date(utc);
}

// "HH:mm" → { hour, minute }. 형식 검증은 Zod(validations)에서 수행한다.
export function parseHHmm(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":");
  return { hour: Number.parseInt(h, 10), minute: Number.parseInt(m, 10) };
}

// "HH:mm" → 자정 기준 분 수(예: "09:30" → 570).
export function hhmmToMinutes(value: string): number {
  const { hour, minute } = parseHHmm(value);
  return hour * 60 + minute;
}

// 숫자를 2자리로 0 패딩("9" → "09"). 날짜/시간 키 생성에 쓴다.
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
