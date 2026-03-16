DROP INDEX IF EXISTS "ds_orders_tenant_id_company_id_customer_id_platform_platform_order_no_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ds_orders_tenant_company_customer_platform_order_product_key"
  ON "ds_orders"("tenant_id", "company_id", "customer_id", "platform", "platform_order_no", "product_id");
