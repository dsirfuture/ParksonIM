CREATE TABLE IF NOT EXISTS "pos_product_configs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "source_product_id" UUID NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "barcode" TEXT,
  "clave" TEXT,
  "name_cn" TEXT,
  "name_es" TEXT,
  "spec" TEXT,
  "pos_price" DECIMAL(14,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "allow_discount" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_product_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_product_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pos_product_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_product_configs_tenant_company_store_source_key"
  ON "pos_product_configs" ("tenant_id", "company_id", "store_id", "source_product_id");
CREATE INDEX IF NOT EXISTS "pos_product_configs_tenant_company_store_idx"
  ON "pos_product_configs" ("tenant_id", "company_id", "store_id");
CREATE INDEX IF NOT EXISTS "pos_product_configs_source_product_idx"
  ON "pos_product_configs" ("source_product_id");
CREATE INDEX IF NOT EXISTS "pos_product_configs_clave_idx"
  ON "pos_product_configs" ("clave");
CREATE INDEX IF NOT EXISTS "pos_product_configs_barcode_idx"
  ON "pos_product_configs" ("barcode");

CREATE TABLE IF NOT EXISTS "pos_suspended_orders" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "folio" TEXT NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "cashier_id" UUID,
  "cashier_name" TEXT NOT NULL,
  "customer_name" TEXT,
  "customer_phone" TEXT,
  "customer_rfc" TEXT,
  "note" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discount_total" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "payment_method" TEXT,
  "status" TEXT NOT NULL DEFAULT 'suspended',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_suspended_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_suspended_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pos_suspended_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_suspended_orders_tenant_company_folio_key"
  ON "pos_suspended_orders" ("tenant_id", "company_id", "folio");
CREATE INDEX IF NOT EXISTS "pos_suspended_orders_tenant_company_store_status_idx"
  ON "pos_suspended_orders" ("tenant_id", "company_id", "store_id", "status");
CREATE INDEX IF NOT EXISTS "pos_suspended_orders_created_at_idx"
  ON "pos_suspended_orders" ("created_at");

CREATE TABLE IF NOT EXISTS "pos_suspended_order_lines" (
  "id" UUID NOT NULL,
  "suspended_order_id" UUID NOT NULL,
  "product_id" TEXT NOT NULL,
  "barcode_snapshot" TEXT,
  "clave_snapshot" TEXT,
  "name_cn_snapshot" TEXT,
  "name_es_snapshot" TEXT,
  "spec_snapshot" TEXT,
  "qty" INTEGER NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL,
  "discount_type" TEXT,
  "discount_value" DECIMAL(14,2),
  "subtotal" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "pos_suspended_order_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_suspended_order_lines_order_fkey" FOREIGN KEY ("suspended_order_id") REFERENCES "pos_suspended_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pos_suspended_order_lines_order_idx"
  ON "pos_suspended_order_lines" ("suspended_order_id");

CREATE TABLE IF NOT EXISTS "pos_quote_records" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "folio" TEXT NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "cashier_id" UUID,
  "cashier_name" TEXT NOT NULL,
  "customer_name" TEXT,
  "customer_phone" TEXT,
  "customer_rfc" TEXT,
  "note" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discount_total" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_quote_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_quote_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pos_quote_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_quote_records_tenant_company_folio_key"
  ON "pos_quote_records" ("tenant_id", "company_id", "folio");
CREATE INDEX IF NOT EXISTS "pos_quote_records_tenant_company_store_status_idx"
  ON "pos_quote_records" ("tenant_id", "company_id", "store_id", "status");
CREATE INDEX IF NOT EXISTS "pos_quote_records_created_at_idx"
  ON "pos_quote_records" ("created_at");

CREATE TABLE IF NOT EXISTS "pos_quote_lines" (
  "id" UUID NOT NULL,
  "quote_id" UUID NOT NULL,
  "product_id" TEXT NOT NULL,
  "barcode_snapshot" TEXT,
  "clave_snapshot" TEXT,
  "name_cn_snapshot" TEXT,
  "name_es_snapshot" TEXT,
  "spec_snapshot" TEXT,
  "qty" INTEGER NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL,
  "discount_type" TEXT,
  "discount_value" DECIMAL(14,2),
  "subtotal" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "pos_quote_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_quote_lines_quote_fkey" FOREIGN KEY ("quote_id") REFERENCES "pos_quote_records"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pos_quote_lines_quote_idx"
  ON "pos_quote_lines" ("quote_id");
