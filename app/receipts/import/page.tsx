import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { AppShell } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { ImportClient } from "./ImportClient";

export default async function ReceiptImportPage() {
  const lang = await getLang();
  const session = await getSession();

  const recentBatches = session
    ? await prisma.importBatch.findMany({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
        },
        include: {
          receipt: {
            select: {
              id: true,
              receipt_no: true,
              supplier_name: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      })
    : [];

  const batchItems = recentBatches.map((batch) => ({
    id: batch.id,
    status: batch.status,
    created_at: batch.created_at.toISOString(),
    receipt: batch.receipt
      ? {
          id: batch.receipt.id,
          receipt_no: batch.receipt.receipt_no,
          supplier_name: batch.receipt.supplier_name,
        }
      : null,
  }));

  return (
    <AppShell>
      <ImportClient lang={lang} recentBatches={batchItems} />
    </AppShell>
  );
}
