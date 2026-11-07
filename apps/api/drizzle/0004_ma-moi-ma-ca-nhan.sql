ALTER TABLE "groups" ADD COLUMN "invite_code" text;--> statement-breakpoint
-- Cấp mã mời cho các nhóm đang có (truy vấn con tham chiếu dòng ngoài để mỗi nhóm một mã riêng).
UPDATE "groups" SET "invite_code" = (
  SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 6) WHERE "groups"."id" IS NOT NULL
);--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "invite_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code");--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "participant_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "players_group_code_key" ON "players" USING btree ("group_id","participant_code");
