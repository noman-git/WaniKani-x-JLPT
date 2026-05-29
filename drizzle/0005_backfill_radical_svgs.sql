-- Backfill `character_image_url` for the 18 WaniKani "image-only" radicals
-- (Beggar, Kick, Pope, …) that have no CJK `characters` glyph. Without a URL
-- the UI has nothing to render and falls back to the bare bracketed meaning
-- ("[Beggar]"). URLs are WaniKani's canonical SVG assets, captured locally by
-- scripts/backfill-radical-svgs.ts and baked into the seed.
--
-- Data-only migration: applies on boot via the Drizzle migrator, runs exactly
-- once (tracked in __drizzle_migrations), and touches no user/progress tables.
-- This is the delivery path to the live VPS DB — the persistent volume is
-- never overwritten by the seed-copy, so reference-data fixes ride migrations.

UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/8v0hjy2gh2dnmh1cgbcg8cedpd58' WHERE `wk_subject_id` = 8766;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/0dhu1giyf87t64fcp993ltgsrf5v' WHERE `wk_subject_id` = 8770;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/l5nl91im7fvbcqjuwg1ovpenb82h' WHERE `wk_subject_id` = 8771;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/zjrb5pypsqst01qqzrf7ikowyrs1' WHERE `wk_subject_id` = 8773;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/w371b37nk3fbuf2p4bfclqu33ayr' WHERE `wk_subject_id` = 8778;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/nb178l9s3p19munbl7unsn8x00k6' WHERE `wk_subject_id` = 8781;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/5p6zuf9o03v8087a7x0qrb1ujpzn' WHERE `wk_subject_id` = 8786;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/15z81qc4c77tmjeypri69yrtipgd' WHERE `wk_subject_id` = 8787;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/c4mr6dvhrg2vozxgg7252hbtkhg9' WHERE `wk_subject_id` = 8788;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/849sumcy9wv911e0cgdt5ux8i6bd' WHERE `wk_subject_id` = 8789;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/dgeoshskssv0r7bnmaxj0o4lt1el' WHERE `wk_subject_id` = 8790;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/bmoqz4z1ilc4u22oyiiylgzitbmt' WHERE `wk_subject_id` = 8791;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/43evwoxebvriistgr2ti2lvnwjkd' WHERE `wk_subject_id` = 8792;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/uz1bb8cvkuu0z8q8urqk3j6dhkzk' WHERE `wk_subject_id` = 8795;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/qllq7st7fa0cld22teqa9d9x0zbt' WHERE `wk_subject_id` = 8796;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/zttqaf4pmr1hyfn4zm1of5d1ey5l' WHERE `wk_subject_id` = 8797;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/v61hmex1837301x4dm1hehpg1wx4' WHERE `wk_subject_id` = 8798;
--> statement-breakpoint
UPDATE `wanikani_radicals` SET `character_image_url` = 'https://files.wanikani.com/xtpqax3w4v50hbunqkij53oruddj' WHERE `wk_subject_id` = 8799;
