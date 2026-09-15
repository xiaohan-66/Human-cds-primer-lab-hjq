CREATE TABLE `primer_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created_at` integer NOT NULL,
	`settings` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `primer_items` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`position` integer NOT NULL,
	`input` text NOT NULL,
	`status` text NOT NULL,
	`settings` text NOT NULL,
	`payload` blob,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL
);
