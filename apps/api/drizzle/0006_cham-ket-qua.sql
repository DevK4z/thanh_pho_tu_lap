ALTER TABLE "focus_sessions" ADD COLUMN "result_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "result_image" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "result_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "result_score" integer;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "result_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "result_tries" integer DEFAULT 0 NOT NULL;