import { zonedWallTimeToUtc } from "@/lib/datetime";

// 후보 기간이 끝난 뒤에도 결과를 다시 볼 수 있도록 남겨두는 유예 일수(FR-13).
export const EXPIRY_GRACE_DAYS = 7;

// 폴 만료 시각(UTC)을 계산한다(FR-13). "마지막 후보 날짜 다음날 0시로부터 유예 일수 뒤 0시(생성자
// 타임존)"의 순간을 반환한다. dates는 "YYYY-MM-DD"(생성자 TZ 기준 날짜)이며 오름차순으로 가정한다
// (createPollSchema가 정렬해 넘긴다). 날짜 계산은 날짜만 다루므로 UTC 산술로 안전하게 한다.
export function computeExpiresAt(dates: string[], timeZone: string): Date {
  const last = dates[dates.length - 1];
  const [y, m, d] = last.split("-").map(Number);

  // 마지막 날짜의 다음 날 + 유예 일수(월/연 롤오버 포함).
  const expiry = new Date(Date.UTC(y, m - 1, d));
  expiry.setUTCDate(expiry.getUTCDate() + 1 + EXPIRY_GRACE_DAYS);

  return zonedWallTimeToUtc(
    expiry.getUTCFullYear(),
    expiry.getUTCMonth() + 1,
    expiry.getUTCDate(),
    0,
    0,
    timeZone,
  );
}
