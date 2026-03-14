import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { z } from "zod";

const RowSchema = z.object({
  receipt_no: z.string().trim().min(1),
  supplier_name: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  barcode: z.string().trim().optional(),
  name_zh: z.string().trim().optional(),
  name_es: z.string().trim().optional(),
  case_pack: z.number().int().nonnegative().optional(),
  expected_qty: z.number().int().positive(),
  sell_price: z.number().nonnegative(),
  discount: z.number().min(0).max(1).optional(),
  normal_discount: z.number().min(0).max(1).optional(),
  vip_discount: z.number().min(0).max(1).optional(),
  line_total: z.number().nonnegative().optional(),
});

const BodySchema = z.object({
  headers: z.array(z.string()).optional(),
  rows: z.array(z.any()).min(1),
});

const HEADER_ALIASES = {
  receipt_no: ["receipt_no", "友购订单号", "单号", "receipt no"],
  supplier_name: ["supplier_name", "供应商", "supplier"],
  sku: ["sku", "编码", "商品编码", "商品编号"],
  barcode: ["barcode", "条码"],
  name_zh: ["name_zh", "中文名"],
  name_es: ["name_es", "西文名"],
  case_pack: ["case_pack", "中包数", "包装数", "箱规"],
  expected_qty: ["expected_qty", "数量", "应收数量"],
  sell_price: ["sell_price", "供应价", "单价mxn", "单价", "price"],
  normal_discount: ["normal_discount", "普通折扣", "discount", "折扣"],
  vip_discount: ["vip_discount", "vip折扣", "VIP折扣", "VIP 折扣"],
  line_total: ["line_total", "金额", "行金额", "行总额"],
} as const;

const REQUIRED_KEYS = [
  "receipt_no",
  "supplier_name",
  "sku",
  "expected_qty",
  "sell_price",
] as const;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeSkuKey(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function isAllowedHeader(title: string) {
  const n = normalize(title);
  return Object.values(HEADER_ALIASES).some((aliases) =>
    aliases.some((item) => normalize(item) === n),
  );
}

function hasRequiredHeader(
  headers: string[],
  key: (typeof REQUIRED_KEYS)[number],
) {
  const aliases = HEADER_ALIASES[key];
  return headers.some((h) =>
    aliases.some((alias) => normalize(alias) === normalize(h)),
  );
}

function getRequiredHeaderLabel(key: (typeof REQUIRED_KEYS)[number]) {
  if (key === "receipt_no") return "友购订单号";
  if (key === "supplier_name") return "供应商";
  if (key === "sku") return "编码";
  if (key === "expected_qty") return "数量";
  return "供应价";
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "SERVER_ERROR",
          errors: [
            { row: 0, field: "session", message: "当前会话未配置租户和公司" },
          ],
        },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsedBody = BodySchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "INVALID_PAYLOAD",
          errors: [{ row: 0, field: "rows", message: "文件内容无法识别" }],
        },
        { status: 400 },
      );
    }

    const { headers = [], rows } = parsedBody.data;
    const normalizedHeaders = headers.map((h) => String(h ?? "").trim());
    const nonEmptyHeaders = normalizedHeaders.filter((h) => h.length > 0);

    if (normalizedHeaders.length === 0 || nonEmptyHeaders.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "HEADER_INVALID",
          errors: [
            { row: 1, field: "headers_summary", message: "请调整表格规范" },
            {
              row: 1,
              field: "headers_empty",
              message: "未读取到表头 请确认首行是否为标题行",
            },
          ],
        },
        { status: 400 },
      );
    }

    const headerErrors: Array<{ row: number; field: string; message: string }> =
      [];
    const blankHeaderIndexes: number[] = [];
    const extraHeaders: string[] = [];

    normalizedHeaders.forEach((header, index) => {
      if (!header) {
        blankHeaderIndexes.push(index + 1);
        return;
      }
      if (!isAllowedHeader(header)) {
        extraHeaders.push(header);
      }
    });

    const missingRequiredHeaders: string[] = [];
    REQUIRED_KEYS.forEach((key) => {
      if (!hasRequiredHeader(normalizedHeaders, key)) {
        missingRequiredHeaders.push(getRequiredHeaderLabel(key));
      }
    });

    if (blankHeaderIndexes.length > 0) {
      headerErrors.push({
        row: 1,
        field: "headers_blank",
        message: `第 ${blankHeaderIndexes.join("、")} 列表头为空 请补齐后再导入`,
      });
    }

    if (extraHeaders.length > 0) {
      const labels = [...new Set(extraHeaders)];
      headerErrors.push({
        row: 1,
        field: "headers_extra",
        message: `检测到多余表头：${labels.join("、")}`,
      });
      headerErrors.push({
        row: 1,
        field: "headers_extra_remove",
        message: `请删除以下表头后再导入：${labels.join("、")}`,
      });
    }

    if (missingRequiredHeaders.length > 0) {
      headerErrors.push({
        row: 1,
        field: "headers_missing",
        message: `缺少必填表头：${missingRequiredHeaders.join("、")}`,
      });
    }

    if (headerErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "HEADER_INVALID",
          errors: [
            { row: 1, field: "headers_summary", message: "请调整表格规范" },
            ...headerErrors,
          ],
        },
        { status: 400 },
      );
    }

    const rowErrors: Array<{ row: number; field: string; message: string }> =
      [];
    const normalizedRows: Array<z.infer<typeof RowSchema>> = [];

    rows.forEach((row, index) => {
      const result = RowSchema.safeParse(row);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          rowErrors.push({
            row: index + 2,
            field: issue.path.join(".") || "row",
            message: `第 ${index + 2} 行字段错误：${issue.path.join(".") || "row"}`,
          });
        });
        return;
      }
      normalizedRows.push(result.data);
    });

    if (rowErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "INVALID_PAYLOAD",
          errors: rowErrors,
        },
        { status: 400 },
      );
    }

    const duplicateKeyMap = new Map<string, number[]>();
    normalizedRows.forEach((row, index) => {
      const key = `${row.receipt_no}__${row.sku}`;
      const list = duplicateKeyMap.get(key) || [];
      list.push(index + 2);
      duplicateKeyMap.set(key, list);
    });

    const duplicateErrors: Array<{
      row: number;
      field: string;
      message: string;
    }> = [];

    for (const [key, rowNos] of duplicateKeyMap.entries()) {
      if (rowNos.length > 1) {
        const [receiptNo, sku] = key.split("__");
        duplicateErrors.push({
          row: rowNos[0],
          field: "receipt_no+sku",
          message: `表格中重复：友购订单号 ${receiptNo} / 编码 ${sku}`,
        });
      }
    }

    if (duplicateErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "FILE_DUPLICATE",
          errors: duplicateErrors,
        },
        { status: 400 },
      );
    }

    const receiptNos = [...new Set(normalizedRows.map((row) => row.receipt_no))];
    if (receiptNos.length > 0) {
      const existingReceipts = await prisma.receipt.findMany({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          receipt_no: { in: receiptNos },
        },
        select: { receipt_no: true },
      });

      if (existingReceipts.length > 0) {
        const uniqueNos = [
          ...new Set(existingReceipts.map((item) => item.receipt_no)),
        ];
        const existsErrors = uniqueNos.map((no) => ({
          row: 0,
          field: "receipt_no",
          message: `此验货单已存在：${no}`,
        }));
        return NextResponse.json(
          { ok: false, errorCode: "RECEIPT_EXISTS", errors: existsErrors },
          { status: 400 },
        );
      }
    }

    // Import preview needs image/barcode/case_pack from product data by SKU.
    const skuList = [
      ...new Set(
        normalizedRows
          .map((row) => row.sku.trim())
          .filter((v) => Boolean(v)),
      ),
    ];
    const yogoRows =
      skuList.length > 0
        ? await prisma.yogoProductSource.findMany({
            where: {
              tenant_id: session.tenantId,
              company_id: session.companyId,
              OR: skuList.map((sku) => ({
                product_code: { equals: sku, mode: "insensitive" as const },
              })),
            },
            select: {
              product_code: true,
              product_no: true,
              name_cn: true,
              name_es: true,
              case_pack: true,
              carton_pack: true,
              source_price: true,
            },
          })
        : [];

    const catalogRows =
      skuList.length > 0
        ? await prisma.productCatalog.findMany({
            where: {
              tenant_id: session.tenantId,
              company_id: session.companyId,
              OR: skuList.map((sku) => ({
                sku: { equals: sku, mode: "insensitive" as const },
              })),
            },
            select: {
              sku: true,
              barcode: true,
              name_zh: true,
              name_es: true,
              case_pack: true,
              carton_pack: true,
              price: true,
            },
          })
        : [];

    const yogoMap = new Map<
      string,
      {
        barcode?: string;
        name_zh?: string;
        name_es?: string;
        case_pack?: number;
        sell_price?: number;
      }
    >();

    for (const item of yogoRows) {
      const payload = {
        barcode: item.product_no || undefined,
        name_zh: item.name_cn || undefined,
        name_es: item.name_es || undefined,
        case_pack: toNumber(item.case_pack) ?? toNumber(item.carton_pack),
        sell_price: toNumber(item.source_price),
      };
      const exactKey = item.product_code.trim().toUpperCase();
      const looseKey = normalizeSkuKey(item.product_code);
      if (!yogoMap.has(exactKey)) yogoMap.set(exactKey, payload);
      if (looseKey && !yogoMap.has(looseKey)) yogoMap.set(looseKey, payload);
    }

    const catalogMap = new Map<
      string,
      {
        barcode?: string;
        name_zh?: string;
        name_es?: string;
        case_pack?: number;
        sell_price?: number;
      }
    >();

    for (const item of catalogRows) {
      const payload = {
        barcode: item.barcode || undefined,
        name_zh: item.name_zh || undefined,
        name_es: item.name_es || undefined,
        case_pack: toNumber(item.case_pack) ?? toNumber(item.carton_pack),
        sell_price: toNumber(item.price),
      };
      const exactKey = item.sku.trim().toUpperCase();
      const looseKey = normalizeSkuKey(item.sku);
      if (!catalogMap.has(exactKey)) catalogMap.set(exactKey, payload);
      if (looseKey && !catalogMap.has(looseKey)) catalogMap.set(looseKey, payload);
    }

    const mergedRows = normalizedRows.map((row) => {
      const exactKey = row.sku.trim().toUpperCase();
      const looseKey = normalizeSkuKey(row.sku);
      const yogo = yogoMap.get(exactKey) || yogoMap.get(looseKey);
      const catalog = catalogMap.get(exactKey) || catalogMap.get(looseKey);
      return {
        ...row,
        barcode: row.barcode || yogo?.barcode || catalog?.barcode,
        name_zh: row.name_zh || yogo?.name_zh || catalog?.name_zh,
        name_es: row.name_es || yogo?.name_es || catalog?.name_es,
        case_pack: row.case_pack ?? yogo?.case_pack ?? catalog?.case_pack,
        sell_price:
          row.sell_price ??
          yogo?.sell_price ??
          catalog?.sell_price ??
          row.sell_price,
      };
    });

    const receiptSet = new Set(mergedRows.map((row) => row.receipt_no));
    const skuSet = new Set(mergedRows.map((row) => row.sku));
    const totalExpectedQty = mergedRows.reduce(
      (sum, row) => sum + (row.expected_qty || 0),
      0,
    );

    return NextResponse.json({
      ok: true,
      summary: {
        totalRows: rows.length,
        receiptCount: receiptSet.size,
        skuCount: skuSet.size,
        totalExpectedQty,
      },
      normalizedRows: mergedRows,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "SERVER_ERROR",
        errors: [
          { row: 0, field: "server", message: "当前未能完成处理 请稍后再试" },
        ],
      },
      { status: 500 },
    );
  }
}
