CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(8) NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp,
	CONSTRAINT "rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "room_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"name" varchar(40) NOT NULL,
	"seat" integer NOT NULL,
	"session_token" uuid NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"connected_at" timestamp,
	"created_at" timestamp,
	CONSTRAINT "room_players_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'playing' NOT NULL,
	"current_seat" integer NOT NULL,
	"deck" jsonb NOT NULL,
	"discard" jsonb NOT NULL,
	"pending_swap" jsonb,
	"pending_draw" jsonb,
	"winning_team" varchar(1),
	"created_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "game_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"seat" integer NOT NULL,
	"hand" jsonb NOT NULL,
	"melds_remaining" integer DEFAULT 5 NOT NULL,
	"discards_remaining" integer DEFAULT 5 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"seat" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_actions" ADD CONSTRAINT "game_actions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_players_room_id_seat_idx" ON "room_players" USING btree ("room_id","seat");--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_game_id_seat_idx" ON "game_players" USING btree ("game_id","seat");