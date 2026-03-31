ALTER TABLE "customer_profiles"
ADD COLUMN IF NOT EXISTS "payment_term_days" INTEGER;

CREATE TABLE IF NOT EXISTS "customer_payment_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "customer_profile_id" UUID NULL,
  "manual_order_record_id" UUID NULL,
  "source_type" TEXT NOT NULL,
  "customer_name" TEXT NOT NULL,
  "order_no" TEXT NOT NULL,
  "payment_amount" DECIMAL(18,2) NULL,
  "paid_at" TIMESTAMP(3) NULL,
  "payment_method" TEXT NULL,
  "payment_target" TEXT NULL,
  "note" TEXT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_payment_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_payment_records_tenant_id_company_id_idx"
  ON "customer_payment_records"("tenant_id", "company_id");

CREATE INDEX IF NOT EXISTS "customer_payment_records_customer_profile_id_idx"
  ON "customer_payment_records"("customer_profile_id");

CREATE INDEX IF NOT EXISTS "customer_payment_records_manual_order_record_id_idx"
  ON "customer_payment_records"("manual_order_record_id");

CREATE INDEX IF NOT EXISTS "customer_payment_records_source_type_order_no_idx"
  ON "customer_payment_records"("source_type", "order_no");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_payment_records_tenant_id_fkey'
  ) THEN
    ALTER TABLE "customer_payment_records"
      ADD CONSTRAINT "customer_payment_records_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_payment_records_company_id_fkey'
  ) THEN
    ALTER TABLE "customer_payment_records"
      ADD CONSTRAINT "customer_payment_records_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_payment_records_customer_profile_id_fkey'
  ) THEN
    ALTER TABLE "customer_payment_records"
      ADD CONSTRAINT "customer_payment_records_customer_profile_id_fkey"
      FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_payment_records_manual_order_record_id_fkey'
  ) THEN
    ALTER TABLE "customer_payment_records"
      ADD CONSTRAINT "customer_payment_records_manual_order_record_id_fkey"
      FOREIGN KEY ("manual_order_record_id") REFERENCES "customer_manual_order_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_customer_payment_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_payment_records_updated_at ON "customer_payment_records";
CREATE TRIGGER trg_customer_payment_records_updated_at
BEFORE UPDATE ON "customer_payment_records"
FOR EACH ROW
EXECUTE FUNCTION set_customer_payment_records_updated_at();
