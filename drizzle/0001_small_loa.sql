CREATE TABLE `calculations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`projectId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`inputData` text NOT NULL,
	`resultData` text NOT NULL,
	`formulaVersion` varchar(32) NOT NULL DEFAULT 'v1.0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calculations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estimates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`projectId` int NOT NULL,
	`reference` varchar(80) NOT NULL,
	`title` varchar(180) NOT NULL,
	`linesData` text NOT NULL,
	`subtotal` decimal(14,2) NOT NULL,
	`taxRate` decimal(5,2) NOT NULL DEFAULT '0',
	`total` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estimates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`category` varchar(80) NOT NULL,
	`label` varchar(180) NOT NULL,
	`unit` varchar(24) NOT NULL,
	`unitPrice` decimal(14,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'XOF',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `priceItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`client` varchar(180) NOT NULL,
	`site` varchar(240) NOT NULL,
	`author` varchar(180) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'XOF',
	`unitSystem` varchar(16) NOT NULL DEFAULT 'métrique',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`progress` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`projectId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`shareToken` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `reports_shareToken_unique` UNIQUE(`shareToken`)
);
--> statement-breakpoint
CREATE INDEX `calculations_project_idx` ON `calculations` (`projectId`);--> statement-breakpoint
CREATE INDEX `estimates_project_idx` ON `estimates` (`projectId`);--> statement-breakpoint
CREATE INDEX `price_items_owner_idx` ON `priceItems` (`ownerId`);--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`ownerId`);--> statement-breakpoint
CREATE INDEX `reports_project_idx` ON `reports` (`projectId`);