CREATE TABLE `custom_videos` (
  `id` varchar(32) NOT NULL,
  `title` varchar(255) NOT NULL,
  `category` varchar(32) NOT NULL,
  `lesson` varchar(255) NOT NULL,
  `section` varchar(32) NOT NULL,
  `solutionGroup` varchar(64),
  `duration` varchar(32),
  `homework` text,
  `description` text,
  `sortOrder` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
