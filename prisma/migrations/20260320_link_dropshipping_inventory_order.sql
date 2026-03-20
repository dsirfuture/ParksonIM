ALTER TABLE "ds_customer_inventories"
  ADD COLUMN IF NOT EXISTS "linked_order_id" UUID;

CREATE INDEX IF NOT EXISTS "ds_customer_inventories_linked_order_idx"
  ON "ds_customer_inventories" ("linked_order_id");
