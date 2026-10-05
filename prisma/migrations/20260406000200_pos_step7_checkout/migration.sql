CREATE TABLE IF NOT EXISTS "pos_sale_records" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "folio" TEXT NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "cashier_id" UUID,
  "cashier_name" TEXT NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'direct',
  "source_id" TEXT,
  "customer_name" TEXT,
  "customer_phone" TEXT,
  "customer_rfc" TEXT,
  "note" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discount_total" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "payment_method" TEXT,
  "received_amount" DECIMAL(14,2) NOT NULL,
  "change_amount" DECIMAL(14,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_sale_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_sale_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pos_sale_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_sale_records_tenant_company_folio_key"
  ON "pos_sale_records" ("tenant_id", "company_id", "folio");
CREATE INDEX IF NOT EXISTS "pos_sale_records_tenant_company_store_status_idx"
  ON "pos_sale_records" ("tenant_id", "company_id", "store_id", "status");
CREATE INDEX IF NOT EXISTS "pos_sale_records_source_type_source_id_idx"
  ON "pos_sale_records" ("source_type", "source_id");
CREATE INDEX IF NOT EXISTS "pos_sale_records_created_at_idx"
  ON "pos_sale_records" ("created_at");

CREATE TABLE IF NOT EXISTS "pos_sale_lines" (
  "id" UUID NOT NULL,
  "sale_record_id" UUID NOT NULL,
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
  CONSTRAINT "pos_sale_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_sale_lines_sale_fkey" FOREIGN KEY ("sale_record_id") REFERENCES "pos_sale_records"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pos_sale_lines_sale_record_idx"
  ON "pos_sale_lines" ("sale_record_id");
