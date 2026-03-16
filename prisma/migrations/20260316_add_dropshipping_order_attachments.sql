DO $$ BEGIN
  CREATE TYPE "DsOrderAttachmentType" AS ENUM ('label', 'proof');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ds_order_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "type" "DsOrderAttachmentType" NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "source_path" TEXT,
  "mime_type" TEXT,
  "file_size" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ds_order_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ds_order_attachments_tenant_company_idx"
  ON "ds_order_attachments"("tenant_id", "company_id");

CREATE INDEX IF NOT EXISTS "ds_order_attachments_order_idx"
  ON "ds_order_attachments"("order_id");

CREATE INDEX IF NOT EXISTS "ds_order_attachments_type_idx"
  ON "ds_order_attachments"("type");

DO $$ BEGIN
  ALTER TABLE "ds_order_attachments"
    ADD CONSTRAINT "ds_order_attachments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ds_order_attachments"
    ADD CONSTRAINT "ds_order_attachments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ds_order_attachments"
    ADD CONSTRAINT "ds_order_attachments_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "ds_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
