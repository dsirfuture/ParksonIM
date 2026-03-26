ALTER TABLE "customer_manual_order_records"
ADD COLUMN IF NOT EXISTS "billing_amount_override" DECIMAL(18, 2);
