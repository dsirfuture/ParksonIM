CREATE TABLE IF NOT EXISTS "billing_action_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "order_no" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "format_type" TEXT,
  "reason_text" TEXT,
  "detail_text" TEXT,
  "operator_id" TEXT,
  "operator_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "billing_action_logs_tenant_company_idx"
  ON "billing_action_logs" ("tenant_id", "company_id");

CREATE INDEX IF NOT EXISTS "billing_action_logs_order_no_created_at_idx"
  ON "billing_action_logs" ("order_no", "created_at");

CREATE INDEX IF NOT EXISTS "billing_action_logs_action_type_created_at_idx"
  ON "billing_action_logs" ("action_type", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'billing_action_logs_tenant_id_fkey'
  ) THEN
    ALTER TABLE "billing_action_logs"
      ADD CONSTRAINT "billing_action_logs_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'billing_action_logs_company_id_fkey'
  ) THEN
    ALTER TABLE "billing_action_logs"
      ADD CONSTRAINT "billing_action_logs_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
