ALTER TABLE `orders` ADD `payment_link_emailed_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `receipt_emailed_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `seller_emailed_at` integer;--> statement-breakpoint
-- Orders from before order emails existed count as handled, so nobody gets an email for an old order.
UPDATE `orders` SET `payment_link_emailed_at` = `created_at`, `receipt_emailed_at` = `created_at`, `seller_emailed_at` = `created_at`;
