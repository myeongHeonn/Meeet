ALTER TABLE "participants" DROP CONSTRAINT "participants_poll_name_unique";--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "edit_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_edit_token_unique" UNIQUE("edit_token");