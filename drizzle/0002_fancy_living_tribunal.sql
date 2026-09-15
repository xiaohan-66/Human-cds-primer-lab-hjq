CREATE INDEX `primer_batches_owner_created` ON `primer_batches` (`owner`,`created_at`);--> statement-breakpoint
CREATE INDEX `primer_items_batch_position` ON `primer_items` (`batch_id`,`position`);