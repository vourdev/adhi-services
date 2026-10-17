-- The site now has one owner. Removes every account except the super admin's,
-- with its data, children first. Does nothing if no super admin exists.
DELETE FROM `digital_deliveries` WHERE `order_id` IN (SELECT `id` FROM `orders` WHERE `profile_id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin'))));--> statement-breakpoint
DELETE FROM `payment_transactions` WHERE `order_id` IN (SELECT `id` FROM `orders` WHERE `profile_id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin'))));--> statement-breakpoint
DELETE FROM `order_items` WHERE `order_id` IN (SELECT `id` FROM `orders` WHERE `profile_id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin'))));--> statement-breakpoint
DELETE FROM `analytics_events` WHERE `profile_id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin')));--> statement-breakpoint
DELETE FROM `orders` WHERE `profile_id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin')));--> statement-breakpoint
DELETE FROM `discount_codes` WHERE `profile_id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin')));--> statement-breakpoint
DELETE FROM `profile_links` WHERE `profile_id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin')));--> statement-breakpoint
DELETE FROM `products` WHERE `profile_id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin')));--> statement-breakpoint
DELETE FROM `social_links` WHERE `profile_id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin')));--> statement-breakpoint
DELETE FROM `profiles` WHERE `id` IN (SELECT `id` FROM `profiles` WHERE `owner_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin')));--> statement-breakpoint
DELETE FROM `sessions` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin'));--> statement-breakpoint
DELETE FROM `membership_logs`;--> statement-breakpoint
DELETE FROM `users` WHERE `id` IN (SELECT `id` FROM `users` WHERE `role` <> 'super_admin' AND EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin'));--> statement-breakpoint
DROP TABLE `membership_logs`;--> statement-breakpoint
ALTER TABLE `profiles` DROP COLUMN `midtrans_mode`;--> statement-breakpoint
ALTER TABLE `profiles` DROP COLUMN `custom_midtrans_server_key`;--> statement-breakpoint
ALTER TABLE `profiles` DROP COLUMN `custom_midtrans_is_production`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `plan`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `plan_expires_at`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `plan_notes`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `plan_granted_by`;