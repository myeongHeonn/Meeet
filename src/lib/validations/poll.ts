import { z } from "zod";
import { getZonedParts, hhmmToMinutes, pad2 } from "@/lib/datetime";

// 격자 폭증 방어(spec §8, plan §7). MAX_DATES는 날짜 개수 상한, MAX_CELLS는 총 칸 상한.
// 31일 × 하루 최대 47칸 = 1457이므로 MAX_CELLS는 1000으로 두어 실질적으로 동작하게 한다
// (예: 31일을 고르면 하루 ≤ 8시간, 10일이면 풀타임까지 허용).
export const MAX_DATES = 31;
export const MAX_CELLS = 1000;
export const SLOT_MINUTES = 30;

// "HH:mm", 30분 단위(분은 00 또는 30)만 허용. 시작 시각용.
const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|30)$/, "30분 단위의 HH:mm 형식이어야 합니다");

// 종료 시각은 하루 끝을 뜻하는 "24:00"(자정)까지 허용한다. 슬롯 경계(exclusive)로만 쓰이므로
// 24:00이 실제 벽시계 슬롯으로 변환되지는 않는다(grid.ts는 mins < endMin으로 펼친다).
const hhmmEnd = z
  .string()
  .regex(
    /^(([01]\d|2[0-3]):(00|30)|24:00)$/,
    "30분 단위의 HH:mm 형식이어야 합니다(종료는 24:00까지)",
  );

// IANA 타임존 문자열. Intl이 받아들이는지로 검증한다.
const ianaTimeZone = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "유효한 타임존이 아닙니다" },
);

function cellsPerDay(startTime: string, endTime: string): number {
  return (hhmmToMinutes(endTime) - hhmmToMinutes(startTime)) / SLOT_MINUTES;
}

// timeZone 기준 "오늘"(YYYY-MM-DD). ISO date 문자열은 사전순=시간순이라 비교에 쓴다.
function todayInZone(timeZone: string): string {
  const p = getZonedParts(new Date(), timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export const createPollSchema = z
  .object({
    title: z.string().trim().min(1, "제목을 입력하세요").max(200),
    description: z.string().trim().max(2000).optional(),
    dates: z
      .array(z.iso.date())
      .min(1, "후보 날짜를 1개 이상 고르세요")
      .max(MAX_DATES, `후보 날짜는 최대 ${MAX_DATES}개입니다`)
      // 중복 제거 + 정렬(이후 격자 펼치기의 입력을 안정화).
      .transform((dates) => [...new Set(dates)].sort()),
    startTime: hhmm,
    endTime: hhmmEnd,
    timeZone: ianaTimeZone,
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "종료 시각은 시작 시각보다 늦어야 합니다",
    path: ["endTime"],
  })
  .refine((v) => cellsPerDay(v.startTime, v.endTime) * v.dates.length <= MAX_CELLS, {
    message: "선택 범위가 너무 큽니다 (시간 칸 수 상한 초과)",
    path: ["dates"],
  })
  .refine(
    (v) => {
      // timeZone이 무효하면 위 필드 검증에서 이미 걸렸으므로 여기선 통과시킨다
      // (무효 타임존으로 getZonedParts를 호출하면 throw하므로 방어).
      let today: string;
      try {
        today = todayInZone(v.timeZone);
      } catch {
        return true;
      }
      return v.dates.every((d) => d >= today);
    },
    { message: "과거 날짜는 선택할 수 없습니다", path: ["dates"] },
  );

export const submitResponseSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요").max(80),
  // "가능"으로 칠한 칸. 빈 배열 허용(전부 불가능도 응답). 중복 제거.
  availableSlotIds: z
    .array(z.uuid())
    .transform((ids) => [...new Set(ids)]),
  // 본인 식별용 편집 토큰(FR-7). 최초 제출엔 없고, 재제출 시 동봉한다.
  editToken: z.uuid().optional(),
});

export type CreatePollInput = z.infer<typeof createPollSchema>;
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
