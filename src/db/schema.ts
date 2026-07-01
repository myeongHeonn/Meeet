import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";

// 미팅 폴. 계정 개념이 없으므로 publicToken을 아는 것이 곧 조회/응답 권한이다.
// 마감/확정 상태는 두지 않는다 — 폴은 상시 열려 있고 결정은 폴 밖에서 내린다.
export const meetingPolls = pgTable("meeting_polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  publicToken: text("public_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// 30분 격자 칸 하나. [선택 날짜 × 시간 범위]를 펼쳐 생성한다. startsAt/endsAt는 UTC 저장.
export const pollSlots = pgTable(
  "poll_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => meetingPolls.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  },
  (t) => [unique("poll_slots_poll_starts_unique").on(t.pollId, t.startsAt)],
);

// 폴에 참여한 사람. 이름은 식별자가 아니며(중복 허용), 본인 식별/수정 권한은 editToken으로 한다(FR-7).
export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  pollId: uuid("poll_id")
    .notNull()
    .references(() => meetingPolls.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  editToken: uuid("edit_token").notNull().unique().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// 참가자가 "가능"으로 칠한 칸. 가능한 칸만 행으로 존재한다(불가능은 행 없음).
export const participantAvailabilities = pgTable(
  "participant_availabilities",
  {
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    pollSlotId: uuid("poll_slot_id")
      .notNull()
      .references(() => pollSlots.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.participantId, t.pollSlotId] })],
);
