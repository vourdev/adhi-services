PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_membership_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`granted_by` text,
	`plan` text NOT NULL,
	`duration_days` integer,
	`expires_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_membership_logs`("id", "user_id", "granted_by", "plan", "duration_days", "expires_at", "notes", "created_at") SELECT "id", "user_id", "granted_by", "plan", "duration_days", "expires_at", "notes", "created_at" FROM `membership_logs`;--> statement-breakpoint
DROP TABLE `membership_logs`;--> statement-breakpoint
ALTER TABLE `__new_membership_logs` RENAME TO `membership_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `membership_logs_user_idx` ON `membership_logs` (`user_id`);