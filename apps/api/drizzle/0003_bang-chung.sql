ALTER TABLE "day_stats" ADD COLUMN "vf" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "day_stats" ADD COLUMN "uv" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "day_stats" ADD COLUMN "rq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "day_stats" ADD COLUMN "rc" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "day_stats" ADD COLUMN "so" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "day_stats" ADD COLUMN "sn" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "proof_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "proof_code" text;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "proof_page" integer;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "proof_exp" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "proof_tries" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "proof_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "recall_due" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "recall_q" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "recall_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "recall_a" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "recall_score" integer;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "recall_verdict" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "recall_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "spot_week" text;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "spot_result" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "unverified_min" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Phiên hoàn thành trước khi có lớp bằng chứng được giữ nguyên điểm và số phút.
UPDATE "focus_sessions" SET "verified" = true WHERE "status" = 'done';--> statement-breakpoint
UPDATE "day_stats" SET "vf" = "c";
