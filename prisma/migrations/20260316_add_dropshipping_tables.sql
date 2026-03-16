CREATE TYPE "DsOrderShippingStatus" AS ENUM ('pending', 'shipped', 'cancelled');
CREATE TYPE "DsFinanceStatus" AS ENUM ('unpaid', 'partial', 'paid');

CREATE TABLE "ds_customers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "contact_name" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "default_platform" TEXT,
  "default_rate_mode" TEXT,
  "default_settle_rule" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ds_products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "name_zh" TEXT NOT NULL,
  "name_es" TEXT,
  "image_url" TEXT,
  "unit_price" DECIMAL(14,2),
  "discount_rate" DECIMAL(8,4),
  "default_shipping_fee" DECIMAL(14,2),
  "default_warehouse" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ds_customer_inventories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "stocked_qty" INTEGER NOT NULL,
  "locked_unit_price" DECIMAL(14,2),
  "locked_discount_rate" DECIMAL(8,4),
  "warehouse" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ds_exchange_rates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "rate_date" TIMESTAMP(3) NOT NULL,
  "base_currency" TEXT NOT NULL DEFAULT 'RMB',
  "target_currency" TEXT NOT NULL DEFAULT 'MXN',
  "rate_value" DECIMAL(14,6) NOT NULL,
  "source_name" TEXT,
  "fetched_at" TIMESTAMP(3),
  "is_manual" BOOLEAN NOT NULL DEFAULT FALSE,
  "manual_note" TEXT,
  "fetch_failed" BOOLEAN NOT NULL DEFAULT FALSE,
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ds_orders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "platform" TEXT NOT NULL,
  "platform_order_no" TEXT NOT NULL,
  "tracking_no" TEXT,
  "shipping_label_file" TEXT,
  "quantity" INTEGER NOT NULL,
  "color" TEXT,
  "warehouse" TEXT,
  "shipping_status" "DsOrderShippingStatus" NOT NULL DEFAULT 'pending',
  "shipped_at" TIMESTAMP(3),
  "shipping_proof_file" TEXT,
  "shipping_fee" DECIMAL(14,2),
  "exchange_rate_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ds_payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL,
  "payment_method" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ds_customers_tenant_company_name_key" ON "ds_customers" ("tenant_id", "company_id", "name");
CREATE INDEX "ds_customers_tenant_company_idx" ON "ds_customers" ("tenant_id", "company_id");
CREATE INDEX "ds_customers_name_idx" ON "ds_customers" ("name");

CREATE UNIQUE INDEX "ds_products_tenant_company_sku_key" ON "ds_products" ("tenant_id", "company_id", "sku");
CREATE INDEX "ds_products_tenant_company_idx" ON "ds_products" ("tenant_id", "company_id");
CREATE INDEX "ds_products_sku_idx" ON "ds_products" ("sku");

CREATE UNIQUE INDEX "ds_customer_inventories_unique_key" ON "ds_customer_inventories" ("tenant_id", "company_id", "customer_id", "product_id");
CREATE INDEX "ds_customer_inventories_tenant_company_idx" ON "ds_customer_inventories" ("tenant_id", "company_id");
CREATE INDEX "ds_customer_inventories_customer_idx" ON "ds_customer_inventories" ("customer_id");
CREATE INDEX "ds_customer_inventories_product_idx" ON "ds_customer_inventories" ("product_id");

CREATE UNIQUE INDEX "ds_exchange_rates_unique_key" ON "ds_exchange_rates" ("tenant_id", "company_id", "rate_date", "base_currency", "target_currency");
CREATE INDEX "ds_exchange_rates_tenant_company_idx" ON "ds_exchange_rates" ("tenant_id", "company_id");
CREATE INDEX "ds_exchange_rates_rate_date_idx" ON "ds_exchange_rates" ("rate_date");

CREATE UNIQUE INDEX "ds_orders_unique_key" ON "ds_orders" ("tenant_id", "company_id", "customer_id", "platform", "platform_order_no");
CREATE INDEX "ds_orders_tenant_company_idx" ON "ds_orders" ("tenant_id", "company_id");
CREATE INDEX "ds_orders_customer_idx" ON "ds_orders" ("customer_id");
CREATE INDEX "ds_orders_product_idx" ON "ds_orders" ("product_id");
CREATE INDEX "ds_orders_shipping_status_idx" ON "ds_orders" ("shipping_status");

CREATE INDEX "ds_payments_tenant_company_idx" ON "ds_payments" ("tenant_id", "company_id");
CREATE INDEX "ds_payments_customer_idx" ON "ds_payments" ("customer_id");
CREATE INDEX "ds_payments_paid_at_idx" ON "ds_payments" ("paid_at");

ALTER TABLE "ds_customers"
  ADD CONSTRAINT "ds_customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ds_products"
  ADD CONSTRAINT "ds_products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ds_customer_inventories"
  ADD CONSTRAINT "ds_customer_inventories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_customer_inventories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_customer_inventories_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "ds_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_customer_inventories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ds_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ds_exchange_rates"
  ADD CONSTRAINT "ds_exchange_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_exchange_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ds_orders"
  ADD CONSTRAINT "ds_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "ds_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ds_products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_orders_exchange_rate_id_fkey" FOREIGN KEY ("exchange_rate_id") REFERENCES "ds_exchange_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ds_payments"
  ADD CONSTRAINT "ds_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ds_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "ds_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
