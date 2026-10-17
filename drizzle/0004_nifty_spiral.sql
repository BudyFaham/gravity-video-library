ALTER TABLE `gravity_sessions` ADD `status` varchar(16) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `gravity_sessions` ADD `endReason` varchar(24);--> statement-breakpoint
ALTER TABLE `gravity_sessions` ADD `endedAt` timestamp;