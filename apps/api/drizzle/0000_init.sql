CREATE TABLE "auth_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_stats" (
	"player_id" uuid NOT NULL,
	"day" text NOT NULL,
	"s" integer DEFAULT 0 NOT NULL,
	"c" integer DEFAULT 0 NOT NULL,
	"q" integer DEFAULT 0 NOT NULL,
	"pl" integer DEFAULT 0 NOT NULL,
	"ac" integer DEFAULT 0 NOT NULL,
	"cs" integer DEFAULT 0 NOT NULL,
	"aw" integer DEFAULT 0 NOT NULL,
	"dn" integer DEFAULT 0 NOT NULL,
	"ms" integer DEFAULT 0 NOT NULL,
	"qa" integer DEFAULT 0 NOT NULL,
	"qc" integer DEFAULT 0 NOT NULL,
	"fs" integer DEFAULT 0 NOT NULL,
	"fn" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "day_stats_player_id_day_pk" PRIMARY KEY("player_id","day")
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"act" text NOT NULL,
	"mode" text NOT NULL,
	"planned_sec" integer NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"day" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"reason" text,
	"active_sec" integer DEFAULT 0 NOT NULL,
	"away_sec" integer DEFAULT 0 NOT NULL,
	"dist" integer DEFAULT 0 NOT NULL,
	"missed" integer DEFAULT 0 NOT NULL,
	"qa" integer DEFAULT 0 NOT NULL,
	"qc" integer DEFAULT 0 NOT NULL,
	"focus" integer,
	"self" integer,
	"note" text DEFAULT '' NOT NULL,
	"questions" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_name_key_unique" UNIQUE("name_key")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"style" text NOT NULL,
	"daily_goal" integer NOT NULL,
	"total_focus_min" integer DEFAULT 0 NOT NULL,
	"plot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quit_reasons" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"act" text NOT NULL,
	"q" text NOT NULL,
	"options" jsonb NOT NULL,
	"answer" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"provider_sub" text,
	"email" text,
	"avatar_url" text,
	"current_group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_stats" ADD CONSTRAINT "day_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_current_group_id_groups_id_fk" FOREIGN KEY ("current_group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "focus_sessions_player_idx" ON "focus_sessions" USING btree ("player_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "focus_sessions_one_active" ON "focus_sessions" USING btree ("player_id") WHERE "focus_sessions"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "players_group_user_key" ON "players" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "questions_group_idx" ON "questions" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_sub_key" ON "users" USING btree ("provider","provider_sub");