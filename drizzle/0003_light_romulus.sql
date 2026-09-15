CREATE TABLE `blast_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`owner` text NOT NULL,
	`created_at` integer NOT NULL,
	`status` text NOT NULL,
	`next_at` integer NOT NULL,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`payload` blob NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blast_jobs_owner_batch` ON `blast_jobs` (`owner`,`batch_id`,`created_at`);