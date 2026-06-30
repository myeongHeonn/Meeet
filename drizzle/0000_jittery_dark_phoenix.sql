CREATE TYPE "public"."poll_status" AS ENUM('open', 'confirmed');--> statement-breakpoint
CREATE TABLE "meeting_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"public_token" text NOT NULL,
	"status" "poll_status" DEFAULT 'open' NOT NULL,
	"confirmed_slot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_polls_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "participant_availabilities" (
	"participant_id" uuid NOT NULL,
	"poll_slot_id" uuid NOT NULL,
	CONSTRAINT "participant_availabilities_participant_id_poll_slot_id_pk" PRIMARY KEY("participant_id","poll_slot_id")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_poll_name_unique" UNIQUE("poll_id","name")
);
--> statement-breakpoint
CREATE TABLE "poll_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	CONSTRAINT "poll_slots_poll_starts_unique" UNIQUE("poll_id","starts_at")
);
--> statement-breakpoint
ALTER TABLE "meeting_polls" ADD CONSTRAINT "meeting_polls_confirmed_slot_id_poll_slots_id_fk" FOREIGN KEY ("confirmed_slot_id") REFERENCES "public"."poll_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_availabilities" ADD CONSTRAINT "participant_availabilities_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_availabilities" ADD CONSTRAINT "participant_availabilities_poll_slot_id_poll_slots_id_fk" FOREIGN KEY ("poll_slot_id") REFERENCES "public"."poll_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_poll_id_meeting_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."meeting_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_slots" ADD CONSTRAINT "poll_slots_poll_id_meeting_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."meeting_polls"("id") ON DELETE cascade ON UPDATE no action;