import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  unique,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// 미팅 폴의 상태. open: 응답 받는 중, confirmed: 시간 확정됨(더 이상 응답/재확정 불가).
export const pollStatus = pgEnum("poll_status", ["open", "confirmed"]);

// 미팅 폴. 계정 개념이 없으므로 publicToken을 아는 것이 곧 조회/응답/확정 권한이다.
export const meetingPolls = pgTable("meeting_polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  publicToken: text("public_token").notNull().unique(),
  status: pollStatus("status").notNull().default("open"),
  // 확정된 칸. 순환 참조(meetingPolls -> pollSlots -> meetingPolls)라 지연 참조한다.
  confirmedSlotId: uuid("confirmed_slot_id").references(
    (): AnyPgColumn => pollSlots.id,
  ),
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
