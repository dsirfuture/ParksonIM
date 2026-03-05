-- PostgreSQL CHECK constraints for ParksonMX

ALTER TABLE "ReceiptItem" ADD CONSTRAINT "case_pack_positive" CHECK ("case_pack" > 0);
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "expected_qty_non_negative" CHECK ("expected_qty" >= 0);
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "good_qty_non_negative" CHECK ("good_qty" >= 0);
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "damaged_qty_non_negative" CHECK ("damaged_qty" >= 0);

-- if unexpected=false then good_qty + damaged_qty <= expected_qty
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "qty_limit_if_expected" CHECK (
  "unexpected" = true OR ("good_qty" + "damaged_qty" <= "expected_qty")
);

ALTER TABLE "ReceiptItem" ADD CONSTRAINT "sell_price_non_negative" CHECK ("sell_price" IS NULL OR "sell_price" >= 0);
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "discount_range" CHECK ("discount" IS NULL OR ("discount" >= 0 AND "discount" <= 100));
