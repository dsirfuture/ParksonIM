CREATE TABLE "pos_refund_records" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "sale_record_id" UUID NOT NULL,
  "folio" TEXT NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "cashier_id" TEXT,
  "cashier_name" TEXT NOT NULL,
  "reason" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discount_total" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_refund_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_refund_lines" (
  "id" UUID NOT NULL,
  "refund_record_id" UUID NOT NULL,
  "sale_line_id" UUID NOT NULL,
  "product_id" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL,
  "subtotal" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "pos_refund_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_refund_records_tenant_id_company_id_folio_key"
  ON "pos_refund_records"("tenant_id","company_id","folio");
CREATE UNIQUE INDEX "pos_refund_records_sale_record_id_key"
  ON "pos_refund_records"("sale_record_id");
CREATE INDEX "pos_refund_records_tenant_id_company_id_store_id_created_at_idx"
  ON "pos_refund_records"("tenant_id","company_id","store_id","created_at");
CREATE INDEX "pos_refund_records_sale_record_id_idx"
  ON "pos_refund_records"("sale_record_id");
CREATE INDEX "pos_refund_lines_refund_record_id_idx"
  ON "pos_refund_lines"("refund_record_id");
CREATE INDEX "pos_refund_lines_sale_line_id_idx"
  ON "pos_refund_lines"("sale_line_id");

ALTER TABLE "pos_refund_records"
  ADD CONSTRAINT "pos_refund_records_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_refund_records"
  ADD CONSTRAINT "pos_refund_records_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_refund_records"
  ADD CONSTRAINT "pos_refund_records_sale_record_id_fkey"
  FOREIGN KEY ("sale_record_id") REFERENCES "pos_sale_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_refund_lines"
  ADD CONSTRAINT "pos_refund_lines_refund_record_id_fkey"
  FOREIGN KEY ("refund_record_id") REFERENCES "pos_refund_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_refund_lines"
  ADD CONSTRAINT "pos_refund_lines_sale_line_id_fkey"
  FOREIGN KEY ("sale_line_id") REFERENCES "pos_sale_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
