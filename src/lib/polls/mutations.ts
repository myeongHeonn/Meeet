import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  meetingPolls,
  participantAvailabilities,
  participants,
  pollSlots,
} from "@/db/schema";
import { generatePublicToken } from "@/lib/token";
import { expandSlots } from "@/lib/polls/grid";
import { allSlotsBelongToPoll, canRespond } from "@/lib/polls/rules";
import type {
  CreatePollInput,
  SubmitResponseInput,
} from "@/lib/validations/poll";

export type MutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 404 | 409; message: string };

// 폴 생성: 격자 슬롯으로 펼쳐 폴+슬롯을 한 트랜잭션으로 삽입하고 토큰을 반환(FR-1,3,4).
export async function createPoll(
  input: CreatePollInput,
): Promise<{ token: string }> {
  const slotTimes = expandSlots(input);
  const token = generatePublicToken();

  await db.transaction(async (tx) => {
    const [poll] = await tx
      .insert(meetingPolls)
      .values({
        title: input.title,
        description: input.description ?? null,
        publicToken: token,
      })
      .returning({ id: meetingPolls.id });

    await tx.insert(pollSlots).values(
      slotTimes.map((s) => ({
        pollId: poll.id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      })),
    );
  });

  return { token };
}

// 참가자 응답 제출/수정(FR-6,7). 같은 이름이면 기존 응답을 완전히 교체한다(부분 갱신 아님).
export async function submitResponse(
  token: string,
  input: SubmitResponseInput,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [poll] = await tx
      .select()
      .from(meetingPolls)
      .where(eq(meetingPolls.publicToken, token))
      .limit(1);
    if (!poll) return { ok: false, status: 404, message: "폴을 찾을 수 없습니다" };
    if (!canRespond(poll.status))
      return { ok: false, status: 409, message: "이미 확정된 폴입니다" };

    const slots = await tx
      .select({ id: pollSlots.id })
      .from(pollSlots)
      .where(eq(pollSlots.pollId, poll.id));
    if (!allSlotsBelongToPoll(input.availableSlotIds, slots.map((s) => s.id)))
      return { ok: false, status: 400, message: "유효하지 않은 시간 칸입니다" };

    // (pollId, name) 기준 upsert로 participantId 확보.
    const [participant] = await tx
      .insert(participants)
      .values({ pollId: poll.id, name: input.name })
      .onConflictDoUpdate({
        target: [participants.pollId, participants.name],
        set: { name: input.name },
      })
      .returning({ id: participants.id });

    // 기존 선택 전부 삭제 → 새 선택 삽입(완전 교체).
    await tx
      .delete(participantAvailabilities)
      .where(eq(participantAvailabilities.participantId, participant.id));
    if (input.availableSlotIds.length > 0) {
      await tx.insert(participantAvailabilities).values(
        input.availableSlotIds.map((slotId) => ({
          participantId: participant.id,
          pollSlotId: slotId,
        })),
      );
    }

    return { ok: true, data: undefined };
  });
}

// 칸 확정(FR-9,10). status='open' 조건부 갱신으로 동시 확정은 먼저 쓴 쪽만 성공(spec §8).
export async function confirmPoll(
  token: string,
  slotId: string,
): Promise<MutationResult> {
  const [poll] = await db
    .select()
    .from(meetingPolls)
    .where(eq(meetingPolls.publicToken, token))
    .limit(1);
  if (!poll) return { ok: false, status: 404, message: "폴을 찾을 수 없습니다" };

  const [slot] = await db
    .select({ id: pollSlots.id })
    .from(pollSlots)
    .where(and(eq(pollSlots.id, slotId), eq(pollSlots.pollId, poll.id)))
    .limit(1);
  if (!slot) return { ok: false, status: 400, message: "이 폴의 시간 칸이 아닙니다" };

  const updated = await db
    .update(meetingPolls)
    .set({ status: "confirmed", confirmedSlotId: slotId })
    .where(
      and(eq(meetingPolls.publicToken, token), eq(meetingPolls.status, "open")),
    )
    .returning({ id: meetingPolls.id });
  if (updated.length === 0)
    return { ok: false, status: 409, message: "이미 확정된 폴입니다" };

  return { ok: true, data: undefined };
}
