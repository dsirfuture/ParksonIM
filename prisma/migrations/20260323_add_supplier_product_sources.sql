CREATE TABLE IF NOT EXISTS "supplier_product_sources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "supplier_profile_id" UUID NOT NULL,
  "supplier_name" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "barcode" TEXT,
  "name_zh" TEXT,
  "name_es" TEXT,
  "case_pack" INTEGER,
  "carton_pack" INTEGER,
  "unit_price" DECIMAL(14, 2),
  "last_import_batch" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "supplier_product_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_product_sources_tenant_company_supplier_sku_key"
  ON "supplier_product_sources" ("tenant_id", "company_id", "supplier_profile_id", "sku");

CREATE INDEX IF NOT EXISTS "supplier_product_sources_tenant_company_supplier_idx"
  ON "supplier_product_sources" ("tenant_id", "company_id", "supplier_profile_id");

CREATE INDEX IF NOT EXISTS "supplier_product_sources_tenant_company_name_idx"
  ON "supplier_product_sources" ("tenant_id", "company_id", "supplier_name");

CREATE INDEX IF NOT EXISTS "supplier_product_sources_sku_idx"
  ON "supplier_product_sources" ("sku");

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_supplier_product_sources_updated_at ON "supplier_product_sources";
CREATE TRIGGER set_supplier_product_sources_updated_at
BEFORE UPDATE ON "supplier_product_sources"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
