ALTER TABLE "ds_orders"
  ADD COLUMN IF NOT EXISTS "snapshot_stocked_qty" INTEGER,
  ADD COLUMN IF NOT EXISTS "snapshot_stock_amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "snapshot_rate_value" DECIMAL(14,6),
  ADD COLUMN IF NOT EXISTS "snapshot_exchanged_amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "snapshot_shipping_amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "snapshot_total_amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "snapshot_paid_amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "snapshot_unpaid_amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMP(3);
