ALTER TABLE "players" ADD COLUMN "gold" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "wood" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "current_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "best_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "tasks_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "tasks_failed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Điền số phiên hoàn thành/thất bại cho người chơi đã có từ lịch sử phiên. Vàng, gỗ và chuỗi bắt đầu từ 0.
UPDATE "players" SET
  "tasks_done" = (SELECT count(*) FROM "focus_sessions" s WHERE s."player_id" = "players"."id" AND s."status" = 'done'),
  "tasks_failed" = (SELECT count(*) FROM "focus_sessions" s WHERE s."player_id" = "players"."id" AND s."status" = 'quit');
