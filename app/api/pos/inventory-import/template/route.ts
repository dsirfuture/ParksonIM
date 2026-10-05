import { NextResponse } from "next/server";
import { buildPosInventoryImportTemplate } from "@/lib/pos/server/pos-inventory-import.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.inventory.import", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  try {
    const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: true });
    if (!storeScope.ok) return storeScope.response;
    const storeId = storeScope.storeId || "";
    const buffer = await buildPosInventoryImportTemplate({ storeId });
    const fileName = `pos-inventory-import-template.xlsx`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "POS_IMPORT_TEMPLATE_FAILED" }, { status: 500 });
  }
}
