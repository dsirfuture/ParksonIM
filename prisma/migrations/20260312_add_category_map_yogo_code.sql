ALTER TABLE "product_category_maps"
ADD COLUMN IF NOT EXISTS "yogo_code" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "product_category_maps_tenant_company_yogo_code_key"
ON "product_category_maps" ("tenant_id", "company_id", "yogo_code");
