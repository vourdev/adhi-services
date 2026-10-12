ALTER TABLE `order_items` ADD `list_amount` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `discount_type` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `discount_value` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `discount_starts_at` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `discount_ends_at` integer;--> statement-breakpoint
-- Carry over the old "harga coret" (compare-at) prices as an equivalent fixed discount.
UPDATE `products` SET `discount_type` = 'fixed', `discount_value` = `compare_at_amount` - `price_amount`, `price_amount` = `compare_at_amount` WHERE `compare_at_amount` IS NOT NULL AND `compare_at_amount` > `price_amount`;
