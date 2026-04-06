ALTER TABLE `grammar_progress` ADD `srs_stage` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `grammar_progress` ADD `interval` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `grammar_progress` ADD `ease_factor` real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE `grammar_progress` ADD `next_review_at` text;--> statement-breakpoint
ALTER TABLE `grammar_progress` ADD `last_reviewed_at` text;--> statement-breakpoint
ALTER TABLE `user_progress` ADD `srs_stage` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_progress` ADD `interval` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_progress` ADD `ease_factor` real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_progress` ADD `next_review_at` text;--> statement-breakpoint
ALTER TABLE `user_progress` ADD `last_reviewed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_progress_user_id_jlpt_item_id_unique` ON `user_progress` (`user_id`,`jlpt_item_id`);