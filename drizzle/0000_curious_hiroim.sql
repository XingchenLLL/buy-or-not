CREATE TABLE `polls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`owner_key_hash` text NOT NULL,
	`title` text NOT NULL,
	`price` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`question` text NOT NULL,
	`image_key` text DEFAULT '' NOT NULL,
	`deadline` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `polls_slug_unique` ON `polls` (`slug`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`poll_id` integer NOT NULL,
	`guest_token_hash` text NOT NULL,
	`nickname` text NOT NULL,
	`choice` text NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_votes_poll_guest` ON `votes` (`poll_id`,`guest_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_votes_poll_created` ON `votes` (`poll_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
