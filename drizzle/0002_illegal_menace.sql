CREATE TABLE `measurements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`projectId` int NOT NULL,
	`elementType` varchar(64) NOT NULL,
	`label` varchar(180) NOT NULL,
	`inputsData` text NOT NULL,
	`resultsData` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `measurements_project_idx` ON `measurements` (`projectId`);