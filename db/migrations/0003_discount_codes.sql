CREATE TABLE `discount_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`code` text NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` integer NOT NULL,
	`product_id` text,
	`max_uses` integer,
	`starts_at` integer,
	`ends_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_codes_profile_code_idx` ON `discount_codes` (`profile_id`,`code`);--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_code_id` text REFERENCES discount_codes(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_code` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `orders_discount_code_idx` ON `orders` (`discount_code_id`,`status`);--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `discount_type`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `discount_value`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `discount_starts_at`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `discount_ends_at`;