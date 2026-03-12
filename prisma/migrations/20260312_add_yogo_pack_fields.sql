ALTER TABLE "yogo_product_sources"
ADD COLUMN IF NOT EXISTS "case_pack" INTEGER,
ADD COLUMN IF NOT EXISTS "carton_pack" INTEGER;
