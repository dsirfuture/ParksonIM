-- Step 23: POS user permission overrides + label metadata

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PosPermissionEffect') THEN
    CREATE TYPE "PosPermissionEffect" AS ENUM ('grant', 'deny');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "pos_user_permission_overrides" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "permission_key" TEXT NOT NULL,
  "effect" "PosPermissionEffect" NOT NULL,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_user_permission_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_user_permission_overrides_tenant_company_user_permission_key_key"
  ON "pos_user_permission_overrides"("tenant_id", "company_id", "user_id", "permission_key");

CREATE INDEX IF NOT EXISTS "pos_user_permission_overrides_tenant_company_user_idx"
  ON "pos_user_permission_overrides"("tenant_id", "company_id", "user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pos_user_permission_overrides_tenant_id_fkey'
  ) THEN
    ALTER TABLE "pos_user_permission_overrides"
      ADD CONSTRAINT "pos_user_permission_overrides_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pos_user_permission_overrides_company_id_fkey'
  ) THEN
    ALTER TABLE "pos_user_permission_overrides"
      ADD CONSTRAINT "pos_user_permission_overrides_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pos_user_permission_overrides_user_id_fkey'
  ) THEN
    ALTER TABLE "pos_user_permission_overrides"
      ADD CONSTRAINT "pos_user_permission_overrides_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pos_user_permission_overrides_permission_key_fkey'
  ) THEN
    ALTER TABLE "pos_user_permission_overrides"
      ADD CONSTRAINT "pos_user_permission_overrides_permission_key_fkey"
      FOREIGN KEY ("permission_key") REFERENCES "permission_definitions"("key") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "pos_product_configs"
  ADD COLUMN IF NOT EXISTS "origin" TEXT,
  ADD COLUMN IF NOT EXISTS "importer" TEXT,
  ADD COLUMN IF NOT EXISTS "short_desc" TEXT;
