CREATE TABLE "session_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"data" text NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lat" real,
	"lng" real,
	"acc" integer
);
--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "review" text;--> statement-breakpoint
ALTER TABLE "session_photos" ADD CONSTRAINT "session_photos_session_id_focus_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_photos_kind_key" ON "session_photos" USING btree ("session_id","kind");--> statement-breakpoint
CREATE INDEX "session_photos_taken_idx" ON "session_photos" USING btree ("taken_at");