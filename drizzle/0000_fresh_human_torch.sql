CREATE TABLE `query_leases` (
	`query` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sequence_cache` (
	`query` text PRIMARY KEY NOT NULL,
	`payload` blob NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upstream_gate` (
	`id` text PRIMARY KEY NOT NULL,
	`next_at` integer NOT NULL
);
