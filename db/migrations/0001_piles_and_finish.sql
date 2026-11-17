ALTER TABLE "games" ADD COLUMN "meld_pile" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "finish_reason" varchar(20);--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "last_action_at" timestamp;--> statement-breakpoint
-- Split the old shared pile (`discard`, entries `{card_id, face_up}`) into the Bolo (`meld_pile`,
-- face-up cards from Jogadas) and the Descarte (`discard`, face-down card ids), keeping order.
UPDATE "games" SET
	"meld_pile" = COALESCE((
		SELECT jsonb_agg(entry.value->>'card_id' ORDER BY entry.ordinality)
		FROM jsonb_array_elements("games"."discard") WITH ORDINALITY AS entry(value, ordinality)
		WHERE jsonb_typeof(entry.value) = 'object' AND (entry.value->>'face_up')::boolean
	), '[]'::jsonb),
	"discard" = COALESCE((
		SELECT jsonb_agg(CASE WHEN jsonb_typeof(entry.value) = 'object' THEN entry.value->'card_id' ELSE entry.value END ORDER BY entry.ordinality)
		FROM jsonb_array_elements("games"."discard") WITH ORDINALITY AS entry(value, ordinality)
		WHERE jsonb_typeof(entry.value) <> 'object' OR NOT (entry.value->>'face_up')::boolean
	), '[]'::jsonb);--> statement-breakpoint
UPDATE "games" SET "finish_reason" = 'no_melds' WHERE "status" = 'finished' AND "finish_reason" IS NULL;--> statement-breakpoint
UPDATE "games" SET "last_action_at" = COALESCE(
	(SELECT MAX("game_actions"."created_at") FROM "game_actions" WHERE "game_actions"."game_id" = "games"."id"),
	"games"."created_at"
);
