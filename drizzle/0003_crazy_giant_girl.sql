-- expires_at 추가(FR-13). 기존 폴은 만료 날짜 정보가 없으므로 created_at + 30일로 backfill한 뒤
-- NOT NULL 제약을 건다(새 폴은 애플리케이션이 생성 시점에 값을 채운다).
ALTER TABLE "meeting_polls" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "meeting_polls" SET "expires_at" = "created_at" + interval '30 days' WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "meeting_polls" ALTER COLUMN "expires_at" SET NOT NULL;
