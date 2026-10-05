-- CreateTable
CREATE TABLE "pos_transfer_records" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "folio" TEXT NOT NULL,
  "from_store_id" TEXT NOT NULL,
  "to_store_id" TEXT NOT NULL,
  "created_by" TEXT,
  "created_by_name" TEXT NOT NULL,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "sent_at" TIMESTAMP(3),
  "received_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pos_transfer_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_transfer_lines" (
  "id" UUID NOT NULL,
  "transfer_record_id" UUID NOT NULL,
  "product_id" TEXT NOT NULL,
  "barcode_snapshot" TEXT,
  "clave_snapshot" TEXT,
  "name_cn_snapshot" TEXT,
  "name_es_snapshot" TEXT,
  "spec_snapshot" TEXT,
  "qty" INTEGER NOT NULL,

  CONSTRAINT "pos_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_transfer_records_tenant_id_company_id_folio_key" ON "pos_transfer_records"("tenant_id", "company_id", "folio");
CREATE INDEX "pos_transfer_records_tenant_id_company_id_from_store_id_st_idx" ON "pos_transfer_records"("tenant_id", "company_id", "from_store_id", "status");
CREATE INDEX "pos_transfer_records_tenant_id_company_id_to_store_id_stat_idx" ON "pos_transfer_records"("tenant_id", "company_id", "to_store_id", "status");
CREATE INDEX "pos_transfer_records_created_at_idx" ON "pos_transfer_records"("created_at");
CREATE INDEX "pos_transfer_lines_transfer_record_id_idx" ON "pos_transfer_lines"("transfer_record_id");

-- AddForeignKey
ALTER TABLE "pos_transfer_records"
  ADD CONSTRAINT "pos_transfer_records_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_transfer_records"
  ADD CONSTRAINT "pos_transfer_records_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_transfer_lines"
  ADD CONSTRAINT "pos_transfer_lines_transfer_record_id_fkey"
  FOREIGN KEY ("transfer_record_id") REFERENCES "pos_transfer_records"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
