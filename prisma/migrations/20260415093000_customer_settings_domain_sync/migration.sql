ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "name_zh" TEXT,
  ADD COLUMN IF NOT EXISTS "name_en" TEXT,
  ADD COLUMN IF NOT EXISTS "remark" TEXT,
  ADD COLUMN IF NOT EXISTS "data_source" TEXT NOT NULL DEFAULT 'platform_created',
  ADD COLUMN IF NOT EXISTS "updated_by_user_id" UUID;

ALTER TABLE "ds_customers"
  ADD COLUMN IF NOT EXISTS "name_zh" TEXT,
  ADD COLUMN IF NOT EXISTS "name_en" TEXT,
  ADD COLUMN IF NOT EXISTS "custom_domain" TEXT,
  ADD COLUMN IF NOT EXISTS "custom_domain_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "default_slug" TEXT,
  ADD COLUMN IF NOT EXISTS "default_access_url" TEXT,
  ADD COLUMN IF NOT EXISTS "domain_source" TEXT NOT NULL DEFAULT 'system_default',
  ADD COLUMN IF NOT EXISTS "domain_status" TEXT NOT NULL DEFAULT 'not_set',
  ADD COLUMN IF NOT EXISTS "domain_updated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "domain_updated_by" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "ds_customers_default_slug_unique_idx"
  ON "ds_customers" ("default_slug")
  WHERE "default_slug" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ds_customers_custom_domain_unique_idx"
  ON "ds_customers" ("custom_domain")
  WHERE "custom_domain" IS NOT NULL;
