CREATE TABLE IF NOT EXISTS "pos_store_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "store_id" TEXT NOT NULL,
  "store_name" TEXT NOT NULL,
  "store_code" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "rfc" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "default_ticket_header" TEXT,
  "ticket_subtitle" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_store_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_store_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pos_store_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_store_settings_tenant_id_company_id_store_id_key"
  ON "pos_store_settings"("tenant_id", "company_id", "store_id");

CREATE INDEX IF NOT EXISTS "pos_store_settings_tenant_id_company_id_store_id_idx"
  ON "pos_store_settings"("tenant_id", "company_id", "store_id");
