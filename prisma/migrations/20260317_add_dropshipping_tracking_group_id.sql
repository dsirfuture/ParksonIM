ALTER TABLE ds_orders
ADD COLUMN IF NOT EXISTS tracking_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_ds_orders_tracking_group_id
ON ds_orders(tracking_group_id);
