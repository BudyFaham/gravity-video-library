CREATE TABLE `gravity_sessions` (
	`id` varchar(96) NOT NULL,
	`username` varchar(128) NOT NULL,
	`ipAddress` varchar(128) NOT NULL,
	`userAgent` text,
	`remember` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gravity_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_requests` (
	`id` varchar(96) NOT NULL,
	`username` varchar(128) NOT NULL,
	`ipAddress` varchar(128) NOT NULL,
	`userAgent` text,
	`remember` int NOT NULL DEFAULT 0,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`denialMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `login_requests_id` PRIMARY KEY(`id`)
);
