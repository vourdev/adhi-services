CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_key` text,
	`profile_id` text NOT NULL,
	`link_id` text,
	`product_id` text,
	`order_id` text,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`visitor_id` text,
	`session_id` text,
	`source` text,
	`referrer_host` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`device` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`link_id`) REFERENCES `profile_links`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_events_event_key_unique` ON `analytics_events` (`event_key`);--> statement-breakpoint
CREATE INDEX `events_profile_type_time_idx` ON `analytics_events` (`profile_id`,`event_type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `events_link_time_idx` ON `analytics_events` (`link_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `events_product_type_time_idx` ON `analytics_events` (`product_id`,`event_type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `events_dedupe_idx` ON `analytics_events` (`visitor_id`,`event_type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identifier` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_attempts_identifier_idx` ON `auth_attempts` (`identifier`,`created_at`);--> statement-breakpoint
CREATE TABLE `digital_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`max_downloads` integer DEFAULT 10 NOT NULL,
	`revoked_at` integer,
	`last_accessed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `digital_deliveries_order_id_unique` ON `digital_deliveries` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`unit_amount` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`profile_id` text NOT NULL,
	`product_id` text NOT NULL,
	`buyer_name` text NOT NULL,
	`buyer_email` text NOT NULL,
	`buyer_phone` text,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`access_token_hash` text NOT NULL,
	`idempotency_key` text,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_code_unique` ON `orders` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency_key_unique` ON `orders` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `orders_profile_status_idx` ON `orders` (`profile_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_product_idx` ON `orders` (`product_id`);--> statement-breakpoint
CREATE INDEX `orders_paid_idx` ON `orders` (`profile_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_order_id` text NOT NULL,
	`provider_transaction_id` text,
	`snap_token` text,
	`redirect_url` text,
	`transaction_status` text,
	`fraud_status` text,
	`payment_type` text,
	`gross_amount` integer NOT NULL,
	`status_checked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_tx_provider_order_idx` ON `payment_transactions` (`provider`,`provider_order_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover_url` text,
	`price_amount` integer NOT NULL,
	`compare_at_amount` integer,
	`product_type` text DEFAULT 'digital' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`checkout_method` text DEFAULT 'whatsapp' NOT NULL,
	`cta_label` text,
	`whatsapp_number` text,
	`whatsapp_template` text,
	`delivery_type` text DEFAULT 'none' NOT NULL,
	`delivery_file_key` text,
	`delivery_file_name` text,
	`delivery_file_size` integer,
	`delivery_url` text,
	`seo_title` text,
	`seo_description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_profile_slug_idx` ON `products` (`profile_id`,`slug`);--> statement-breakpoint
CREATE INDEX `products_profile_status_idx` ON `products` (`profile_id`,`status`);--> statement-breakpoint
CREATE TABLE `profile_links` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`kind` text DEFAULT 'link' NOT NULL,
	`title` text,
	`description` text,
	`url` text,
	`thumbnail_url` text,
	`category` text,
	`layout` text DEFAULT 'classic' NOT NULL,
	`product_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_links_profile_idx` ON `profile_links` (`profile_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `profile_links_product_idx` ON `profile_links` (`product_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`cover_url` text,
	`theme` text DEFAULT 'system' NOT NULL,
	`accent` text DEFAULT 'blue' NOT NULL,
	`whatsapp_number` text,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);--> statement-breakpoint
CREATE INDEX `profiles_owner_idx` ON `profiles` (`owner_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `social_links` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`platform` text NOT NULL,
	`url` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_links_profile_idx` ON `social_links` (`profile_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_key` text NOT NULL,
	`order_code` text,
	`payload` text NOT NULL,
	`result` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_key_idx` ON `webhook_events` (`provider`,`event_key`);