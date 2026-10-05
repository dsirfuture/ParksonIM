CREATE TABLE IF NOT EXISTS "pos_store_inventories" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "product_id" TEXT NOT NULL,
  "on_hand_qty" INTEGER NOT NULL DEFAULT 0,
  "reserved_qty" INTEGER NOT NULL DEFAULT 0,
  "available_qty" INTEGER NOT NULL DEFAULT 0,
  "min_stock" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_store_inventories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_store_inventories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pos_store_inventories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_store_inventories_tenant_company_store_product_key"
  ON "pos_store_inventories" ("tenant_id", "company_id", "store_id", "product_id");
CREATE INDEX IF NOT EXISTS "pos_store_inventories_tenant_company_store_active_idx"
  ON "pos_store_inventories" ("tenant_id", "company_id", "store_id", "active");
CREATE INDEX IF NOT EXISTS "pos_store_inventories_product_idx"
  ON "pos_store_inventories" ("product_id");

CREATE TABLE IF NOT EXISTS "pos_inventory_movements" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "product_id" TEXT NOT NULL,
  "move_type" TEXT NOT NULL,
  "qty_change" INTEGER NOT NULL,
  "qty_before" INTEGER NOT NULL,
  "qty_after" INTEGER NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT,
  "source_folio" TEXT,
  "note" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_inventory_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pos_inventory_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pos_inventory_movements_tenant_company_store_created_idx"
  ON "pos_inventory_movements" ("tenant_id", "company_id", "store_id", "created_at");
CREATE INDEX IF NOT EXISTS "pos_inventory_movements_product_created_idx"
  ON "pos_inventory_movements" ("product_id", "created_at");
CREATE INDEX IF NOT EXISTS "pos_inventory_movements_source_idx"
  ON "pos_inventory_movements" ("source_type", "source_id");
