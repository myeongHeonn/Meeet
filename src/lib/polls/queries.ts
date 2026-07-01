import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  meetingPolls,
  participantAvailabilities,
  participants,
  pollSlots,
} from "@/db/schema";
import { isPollExpired } from "@/lib/polls/rules";

export interface PollData {
  poll: typeof meetingPolls.$inferSelect;
  slots: (typeof pollSlots.$inferSelect)[];
  participants: (typeof participants.$inferSelect)[];
  availabilities: (typeof participantAvailabilities.$inferSelect)[];
}

// 공개 토큰으로 폴 전체(폴+슬롯+참가자+가능표시)를 조회한다. 없으면 null(→ 404, spec §8).
export async function getPollByToken(token: string): Promise<PollData | null> {
  const [poll] = await db
    .select()
    .from(meetingPolls)
    .where(eq(meetingPolls.publicToken, token))
    .limit(1);
  // 만료된 폴은 아직 삭제 전이라도 없는 것으로 취급한다(→404, FR-13).
  if (!poll || isPollExpired(poll.expiresAt)) return null;

  const slots = await db
    .select()
    .from(pollSlots)
    .where(eq(pollSlots.pollId, poll.id))
    .orderBy(asc(pollSlots.startsAt));

  const parts = await db
    .select()
    .from(participants)
    .where(eq(participants.pollId, poll.id));

  const participantIds = parts.map((p) => p.id);
  const availabilities =
    participantIds.length > 0
      ? await db
          .select()
          .from(participantAvailabilities)
          .where(inArray(participantAvailabilities.participantId, participantIds))
      : [];

  return { poll, slots, participants: parts, availabilities };
}
