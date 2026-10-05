CREATE TABLE "pos_ticket_settings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "ticket_header_name" TEXT,
  "ticket_header_subtitle" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "rfc" TEXT,
  "footer_line_1" TEXT,
  "footer_line_2" TEXT,
  "show_rfc" BOOLEAN NOT NULL DEFAULT false,
  "show_cashier" BOOLEAN NOT NULL DEFAULT true,
  "show_customer" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pos_ticket_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_ticket_settings_tenant_id_company_id_store_id_key"
  ON "pos_ticket_settings"("tenant_id", "company_id", "store_id");

CREATE INDEX "pos_ticket_settings_tenant_id_company_id_store_id_idx"
  ON "pos_ticket_settings"("tenant_id", "company_id", "store_id");

ALTER TABLE "pos_ticket_settings"
  ADD CONSTRAINT "pos_ticket_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_ticket_settings"
  ADD CONSTRAINT "pos_ticket_settings_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
