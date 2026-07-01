ALTER TABLE "meeting_polls" DROP CONSTRAINT "meeting_polls_confirmed_slot_id_poll_slots_id_fk";
--> statement-breakpoint
ALTER TABLE "meeting_polls" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "meeting_polls" DROP COLUMN "confirmed_slot_id";--> statement-breakpoint
DROP TYPE "public"."poll_status";