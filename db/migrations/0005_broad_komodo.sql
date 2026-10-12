CREATE TABLE `membership_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`granted_by` text NOT NULL,
	`plan` text NOT NULL,
	`duration_days` integer,
	`expires_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `membership_logs_user_idx` ON `membership_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_name` text DEFAULT 'Adhi Web Services' NOT NULL,
	`brand_tagline` text DEFAULT 'Satu link untuk segala profil dan produk Anda',
	`brand_logo_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `theme_preset` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `custom_theme` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `font_family` text DEFAULT 'Plus Jakarta Sans' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `card_shape` text DEFAULT 'smooth' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `card_style` text DEFAULT 'solid' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `hide_watermark` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `custom_favicon_url` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `og_image_url` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `tracking_pixels` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `midtrans_mode` text DEFAULT 'platform' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `custom_midtrans_server_key` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `custom_midtrans_is_production` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `plan` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `plan_expires_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `plan_notes` text;--> statement-breakpoint
ALTER TABLE `users` ADD `plan_granted_by` text;