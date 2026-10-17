DROP INDEX `digital_deliveries_order_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `digital_deliveries_order_product_idx` ON `digital_deliveries` (`order_id`,`product_id`);