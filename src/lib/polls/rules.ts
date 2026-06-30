// 폴 동작의 분기 판정(순수 함수, DB 무관). DB 통합 테스트 없이도 400/409 분기의
// 근거를 단위 테스트로 커버하기 위해 mutation에서 떼어냈다(plan §5, §7).

import type { pollStatus } from "@/db/schema";

type PollStatus = (typeof pollStatus.enumValues)[number]; // "open" | "confirmed"

// 요청한 모든 칸이 해당 폴의 칸 집합에 속하는가(응답/확정 전 검증, spec §8).
export function allSlotsBelongToPoll(
  requestedSlotIds: string[],
  pollSlotIds: Iterable<string>,
): boolean {
  const set = pollSlotIds instanceof Set ? pollSlotIds : new Set(pollSlotIds);
  return requestedSlotIds.every((id) => set.has(id));
}

// open 상태에서만 응답을 받는다(FR-10).
export function canRespond(status: PollStatus): boolean {
  return status === "open";
}

// open 상태에서만 확정할 수 있다(FR-9, FR-10).
export function canConfirm(status: PollStatus): boolean {
  return status === "open";
}
