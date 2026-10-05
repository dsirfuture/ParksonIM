CREATE TABLE IF NOT EXISTS "pos_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "action_type" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "actor_name" TEXT NOT NULL,
  "actor_role" TEXT NOT NULL,
  "store_id" TEXT,
  "target_type" TEXT,
  "target_id" TEXT,
  "target_folio" TEXT,
  "summary" TEXT NOT NULL,
  "details_json" JSONB,
  "result_status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pos_audit_logs_tenant_company_created_at_idx"
  ON "pos_audit_logs"("tenant_id", "company_id", "created_at");
CREATE INDEX IF NOT EXISTS "pos_audit_logs_tenant_company_store_created_at_idx"
  ON "pos_audit_logs"("tenant_id", "company_id", "store_id", "created_at");
CREATE INDEX IF NOT EXISTS "pos_audit_logs_tenant_company_actor_created_at_idx"
  ON "pos_audit_logs"("tenant_id", "company_id", "actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "pos_audit_logs_tenant_company_module_action_result_idx"
  ON "pos_audit_logs"("tenant_id", "company_id", "module", "action_type", "result_status");

ALTER TABLE "pos_audit_logs"
  ADD CONSTRAINT "pos_audit_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_audit_logs"
  ADD CONSTRAINT "pos_audit_logs_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
