CREATE TABLE IF NOT EXISTS `grammar_item_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grammar_point_id` integer NOT NULL,
	`jlpt_item_id` integer NOT NULL,
	FOREIGN KEY (`grammar_point_id`) REFERENCES `grammar_points`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`jlpt_item_id`) REFERENCES `jlpt_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `grammar_item_links_grammar_point_id_jlpt_item_id_unique` ON `grammar_item_links` (`grammar_point_id`,`jlpt_item_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `grammar_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`grammar_point_id` integer NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grammar_point_id`) REFERENCES `grammar_points`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `grammar_notes_user_id_grammar_point_id_unique` ON `grammar_notes` (`user_id`,`grammar_point_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `grammar_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`title_romaji` text NOT NULL,
	`meaning` text NOT NULL,
	`structure` text NOT NULL,
	`explanation` text NOT NULL,
	`jlpt_level` text NOT NULL,
	`lesson_number` integer DEFAULT 0 NOT NULL,
	`lesson_title` text DEFAULT '' NOT NULL,
	`examples` text DEFAULT '[]' NOT NULL,
	`related_grammar_slugs` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `grammar_points_slug_unique` ON `grammar_points` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `grammar_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`grammar_point_id` integer NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grammar_point_id`) REFERENCES `grammar_points`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `grammar_progress_user_id_grammar_point_id_unique` ON `grammar_progress` (`user_id`,`grammar_point_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `invite_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`used_by` integer,
	`created_at` text NOT NULL,
	`used_at` text,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `invite_codes_code_unique` ON `invite_codes` (`code`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `jlpt_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expression` text NOT NULL,
	`reading` text NOT NULL,
	`meaning` text NOT NULL,
	`type` text NOT NULL,
	`jlpt_level` text NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kanji_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query_key` text NOT NULL,
	`response_json` text NOT NULL,
	`cached_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `kanji_cache_query_key_unique` ON `kanji_cache` (`query_key`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`jlpt_item_id` integer NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`jlpt_item_id`) REFERENCES `jlpt_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_notes_user_id_jlpt_item_id_unique` ON `user_notes` (`user_id`,`jlpt_item_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`jlpt_item_id` integer NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`jlpt_item_id`) REFERENCES `jlpt_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `wanikani_radicals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wk_subject_id` integer NOT NULL,
	`characters` text,
	`meanings` text NOT NULL,
	`wk_level` integer NOT NULL,
	`character_image_url` text,
	`meaning_mnemonic` text,
	`meaning_hint` text,
	`amalgamation_subject_ids` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `wanikani_radicals_wk_subject_id_unique` ON `wanikani_radicals` (`wk_subject_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `wanikani_subjects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wk_subject_id` integer NOT NULL,
	`characters` text,
	`meanings` text NOT NULL,
	`readings` text NOT NULL,
	`wk_level` integer NOT NULL,
	`object_type` text NOT NULL,
	`matched_jlpt_item_id` integer,
	`match_type` text,
	`component_subject_ids` text,
	`amalgamation_subject_ids` text,
	`meaning_mnemonic` text,
	`reading_mnemonic` text,
	`meaning_hint` text,
	`reading_hint` text,
	`context_sentences` text,
	`patterns_of_use` text,
	`parts_of_speech` text,
	FOREIGN KEY (`matched_jlpt_item_id`) REFERENCES `jlpt_items`(`id`) ON UPDATE no action ON DELETE no action
);
