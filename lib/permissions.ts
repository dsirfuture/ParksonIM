// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { CUSTOMER_SETTINGS_PERMISSION_KEYS } from "@/lib/customer-settings";
import { Session } from "@/lib/tenant";
import { withPrismaRetry } from "@/lib/prisma-retry";
import type { PosUserRole } from "@/lib/pos/access";

export type PermissionKey =
  | "manageSuppliers"
  | "manageProducts"
  | "manageCustomers"
  | "exportProductCatalog"
  | "viewReports"
  | "inspectGoods"
  | "importReceipts"
  | "exportAllData"
  | "viewAllData";

export type PermissionState = Record<PermissionKey, boolean>;

export const WORKER_DEFAULT_PERMISSIONS: PermissionState = {
  manageSuppliers: true,
  manageProducts: true,
  manageCustomers: true,
  exportProductCatalog: true,
  viewReports: true,
  inspectGoods: true,
  importReceipts: true,
  exportAllData: false,
  viewAllData: false,
};

export const ADMIN_PERMISSIONS: PermissionState = {
  manageSuppliers: true,
  manageProducts: true,
  manageCustomers: true,
  exportProductCatalog: true,
  viewReports: true,
  inspectGoods: true,
  importReceipts: true,
  exportAllData: true,
  viewAllData: true,
};

export const APP_PERMISSION_DEFINITIONS = [
  { key: "dashboard.view", module: "dashboard", page: "dashboard", action: "view", label: "仪表盘", description: "浏览仪表盘首页", sortOrder: 10 },
  { key: "yg_data.view", module: "yg_data", page: "module", action: "view", label: "友购数据", description: "访问友购数据模块", sortOrder: 20 },
  { key: "yg_data.orders.view", module: "yg_data", page: "orders", action: "view", label: "友购订单", description: "查看友购订单页面", sortOrder: 21 },
  { key: "yg_data.customers.view", module: "yg_data", page: "customers", action: "view", label: "友购客户", description: "查看友购客户页面", sortOrder: 22 },
  { key: "products.view", module: "products", page: "catalog", action: "view", label: "友购产品", description: "查看产品目录", sortOrder: 30 },
  { key: "products.export", module: "products", page: "catalog", action: "export", label: "导出产品", description: "导出产品 PDF/XLSX", sortOrder: 31 },
  { key: "inspection.view", module: "inspection", page: "receipts", action: "view", label: "验货单", description: "查看验货单页面", sortOrder: 40 },
  { key: "inspection.create", module: "inspection", page: "receipts", action: "create", label: "新建验货单", description: "导入或创建验货单", sortOrder: 41 },
  { key: "inspection.edit", module: "inspection", page: "receipts", action: "edit", label: "编辑验货单", description: "编辑验货单内容", sortOrder: 42 },
  { key: "inspection.export", module: "inspection", page: "receipts", action: "export", label: "导出验货单", description: "导出验货单 PDF/XLSX", sortOrder: 43 },
  { key: "billing.view", module: "billing", page: "billing", action: "view", label: "账单", description: "查看账单页面", sortOrder: 50 },
  { key: "billing.create", module: "billing", page: "billing", action: "create", label: "生成账单", description: "生成或复制账单", sortOrder: 51 },
  { key: "billing.edit", module: "billing", page: "billing", action: "edit", label: "编辑账单", description: "编辑账单资料", sortOrder: 52 },
  { key: "billing.export", module: "billing", page: "billing", action: "export", label: "导出账单", description: "导出账单 PDF/XLSX", sortOrder: 53 },
  { key: "dropshipping.view", module: "dropshipping", page: "module", action: "view", label: "一件代发", description: "访问一件代发模块", sortOrder: 60 },
  { key: "dropshipping.overview.view", module: "dropshipping", page: "overview", action: "view", label: "总览", description: "查看一件代发总览", sortOrder: 61 },
  { key: "dropshipping.orders.view", module: "dropshipping", page: "orders", action: "view", label: "订单管理", description: "查看代发订单", sortOrder: 62 },
  { key: "dropshipping.orders.edit", module: "dropshipping", page: "orders", action: "edit", label: "编辑订单", description: "编辑代发订单", sortOrder: 63 },
  { key: "dropshipping.orders.export", module: "dropshipping", page: "orders", action: "export", label: "导出订单", description: "导出代发订单", sortOrder: 64 },
  { key: "dropshipping.inventory.view", module: "dropshipping", page: "inventory", action: "view", label: "已发商品", description: "查看已发商品", sortOrder: 65 },
  { key: "dropshipping.inventory.export", module: "dropshipping", page: "inventory", action: "export", label: "导出已发商品", description: "导出库存或已发商品", sortOrder: 66 },
  { key: "dropshipping.finance.view", module: "dropshipping", page: "finance", action: "view", label: "财务结算", description: "查看代发财务结算", sortOrder: 67 },
  { key: "dropshipping.finance.export", module: "dropshipping", page: "finance", action: "export", label: "导出结算", description: "导出代发结算数据", sortOrder: 68 },
  { key: "dropshipping.supplier_misc.view", module: "dropshipping", page: "supplier_misc", action: "view", label: "供应商散单记录", description: "查看供应商散单记录", sortOrder: 69 },
  { key: "dropshipping.supplier_misc.edit", module: "dropshipping", page: "supplier_misc", action: "edit", label: "编辑散单记录", description: "维护供应商散单记录", sortOrder: 70 },
  { key: "dropshipping.supplier_misc.export", module: "dropshipping", page: "supplier_misc", action: "export", label: "导出散单记录", description: "导出供应商散单记录", sortOrder: 71 },
  { key: "dropshipping.quick_setup.view", module: "dropshipping", page: "quick_setup", action: "view", label: "代发快捷设置", description: "访问代发快捷设置", sortOrder: 72 },
  { key: "dropshipping.quick_setup.edit", module: "dropshipping", page: "quick_setup", action: "edit", label: "编辑快捷设置", description: "编辑代发快捷设置", sortOrder: 73 },
  { key: "dropshipping.quick_setup.store_binding.view", module: "dropshipping", page: "store_binding", action: "view", label: "绑定店铺", description: "查看店铺绑定", sortOrder: 74 },
  { key: "dropshipping.quick_setup.store_binding.edit", module: "dropshipping", page: "store_binding", action: "edit", label: "编辑店铺绑定", description: "绑定或更新店铺状态", sortOrder: 75 },
  { key: "dropshipping.quick_setup.product_selection.view", module: "dropshipping", page: "product_selection", action: "view", label: "选择产品", description: "查看和选择产品", sortOrder: 76 },
  { key: "dropshipping.quick_setup.draft_generation.view", module: "dropshipping", page: "draft_generation", action: "view", label: "生成产品草稿", description: "查看草稿生成结果", sortOrder: 77 },
  { key: "dropshipping.quick_setup.draft_generation.create", module: "dropshipping", page: "draft_generation", action: "create", label: "创建产品草稿", description: "批量生成产品草稿", sortOrder: 78 },
  { key: "pos.view", module: "pos", page: "module", action: "view", label: "百盛POS", description: "访问百盛POS模块", sortOrder: 80 },
  { key: "pos.workbench.view", module: "pos", page: "workbench", action: "view", label: "工作台", description: "查看POS工作台", sortOrder: 81 },
  { key: "pos.cashier.view", module: "pos", page: "cashier", action: "view", label: "收银台", description: "查看POS收银台", sortOrder: 82 },
  { key: "pos.sale.checkout", module: "pos", page: "cashier", action: "checkout", label: "收银成交", description: "执行POS收银成交", sortOrder: 82.1 },
  { key: "pos.suspended.view", module: "pos", page: "suspended", action: "view", label: "挂起单", description: "查看挂起单页面", sortOrder: 83 },
  { key: "pos.quote.view", module: "pos", page: "quote", action: "view", label: "预售报价", description: "查看预售报价页面", sortOrder: 84 },
  { key: "pos.sales_docs.view", module: "pos", page: "sales_docs", action: "view", label: "销售单据", description: "查看销售单据页面", sortOrder: 85 },
  { key: "pos.sale.view", module: "pos", page: "sales_docs", action: "view_data", label: "查看销售", description: "查看POS销售单与详情", sortOrder: 85.1 },
  { key: "pos.sale.refund", module: "pos", page: "sales_docs", action: "refund", label: "退款", description: "执行POS销售退款", sortOrder: 85.2 },
  { key: "pos.sale.export", module: "pos", page: "sales_docs", action: "export", label: "导出销售", description: "导出POS销售单数据", sortOrder: 85.3 },
  { key: "pos.returns_void.view", module: "pos", page: "returns_void", action: "view", label: "退货/作废", description: "查看退货与作废页面", sortOrder: 86 },
  { key: "pos.products_prices.view", module: "pos", page: "products_prices", action: "view", label: "商品与价格", description: "查看商品与价格页面", sortOrder: 87 },
  { key: "pos.label.print", module: "pos", page: "labels", action: "print", label: "打印标签", description: "打印POS商品价格标签", sortOrder: 87.1 },
  { key: "pos.store_inventory.view", module: "pos", page: "store_inventory", action: "view", label: "门店库存", description: "查看门店库存页面", sortOrder: 88 },
  { key: "pos.inventory.view", module: "pos", page: "store_inventory", action: "view_data", label: "查看库存", description: "查看POS门店库存数据", sortOrder: 88.1 },
  { key: "pos.inventory.adjust", module: "pos", page: "store_inventory", action: "adjust", label: "调整库存", description: "手工调整门店库存", sortOrder: 88.2 },
  { key: "pos.inventory.count", module: "pos", page: "store_inventory", action: "count", label: "库存盘点", description: "执行库存盘点并设定最终库存", sortOrder: 88.3 },
  { key: "pos.inventory.damage", module: "pos", page: "store_inventory", action: "damage", label: "库存报损", description: "执行库存报损扣减", sortOrder: 88.4 },
  { key: "pos.inventory.export", module: "pos", page: "store_inventory", action: "export", label: "导出库存", description: "导出门店库存数据", sortOrder: 88.5 },
  { key: "pos.inventory_movement.view", module: "pos", page: "inventory_movement", action: "view", label: "库存流水", description: "查看库存流水页面", sortOrder: 89 },
  { key: "pos.inventory.movements.view", module: "pos", page: "inventory_movement", action: "view_data", label: "查看库存流水", description: "查看POS库存流水数据", sortOrder: 89.1 },
  { key: "pos.inventory_import.view", module: "pos", page: "inventory_import", action: "view", label: "库存导入", description: "查看库存导入页面", sortOrder: 90 },
  { key: "pos.inventory.import", module: "pos", page: "inventory_import", action: "import", label: "导入库存", description: "执行POS库存导入", sortOrder: 90.1 },
  { key: "pos.transfers.view", module: "pos", page: "transfers", action: "view", label: "门店调拨", description: "查看门店调拨页面", sortOrder: 91 },
  { key: "pos.transfer.view", module: "pos", page: "transfers", action: "view_data", label: "查看调拨", description: "查看POS调拨数据", sortOrder: 91.1 },
  { key: "pos.transfer.create", module: "pos", page: "transfers", action: "create", label: "创建调拨", description: "创建POS门店调拨", sortOrder: 91.2 },
  { key: "pos.transfer.send", module: "pos", page: "transfers", action: "send", label: "发出调拨", description: "发出POS门店调拨", sortOrder: 91.3 },
  { key: "pos.transfer.receive", module: "pos", page: "transfers", action: "receive", label: "确认收货", description: "确认POS门店调拨收货", sortOrder: 91.4 },
  { key: "pos.finance_stats.view", module: "pos", page: "finance_stats", action: "view", label: "财务统计", description: "查看财务统计页面", sortOrder: 92 },
  { key: "pos.report.finance.view", module: "pos", page: "finance_stats", action: "view_data", label: "查看财务统计", description: "查看POS经营财务统计", sortOrder: 92.1 },
  { key: "pos.inventory_stats.view", module: "pos", page: "inventory_stats", action: "view", label: "库存统计", description: "查看库存统计页面", sortOrder: 93 },
  { key: "pos.report.inventory.view", module: "pos", page: "inventory_stats", action: "view_data", label: "查看库存统计", description: "查看POS库存统计", sortOrder: 93.1 },
  { key: "pos.replenishment.view", module: "pos", page: "replenishment", action: "view", label: "补货建议", description: "查看补货建议页面", sortOrder: 94 },
  { key: "pos.report.export", module: "pos", page: "reports", action: "export", label: "导出统计", description: "导出POS统计与建议数据", sortOrder: 94.1 },
  { key: "pos.audit_logs.view", module: "pos", page: "audit_logs", action: "view", label: "操作日志", description: "查看POS操作日志页面", sortOrder: 95 },
  { key: "pos.audit.view", module: "pos", page: "audit_logs", action: "view_data", label: "查看日志", description: "查看POS操作日志数据", sortOrder: 95.1 },
  { key: "pos.cashiers.view", module: "pos", page: "cashiers", action: "view", label: "收银员管理", description: "查看收银员管理页面", sortOrder: 95 },
  { key: "pos.cashier.manage", module: "pos", page: "cashiers", action: "manage", label: "管理收银员", description: "新增编辑启停POS收银员", sortOrder: 95.2 },
  { key: "pos.store_settings.view", module: "pos", page: "store_settings", action: "view", label: "门店设置", description: "查看门店设置页面", sortOrder: 96 },
  { key: "pos.store.manage", module: "pos", page: "store_settings", action: "manage", label: "管理门店", description: "编辑POS门店设置", sortOrder: 96.1 },
  { key: "pos.receipt_template.view", module: "pos", page: "receipt_template", action: "view", label: "小票模板", description: "查看小票模板页面", sortOrder: 97 },
  { key: "pos.ticket.manage", module: "pos", page: "receipt_template", action: "manage", label: "管理小票设置", description: "编辑POS小票设置", sortOrder: 97.1 },
  { key: "pos.system_settings.view", module: "pos", page: "system_settings", action: "view", label: "系统设置", description: "查看POS系统设置页面", sortOrder: 98 },
  { key: "settings.view", module: "settings", page: "settings", action: "view", label: "设置", description: "查看设置页面", sortOrder: 90 },
  { key: "settings.manage", module: "settings", page: "settings", action: "manage", label: "管理设置", description: "维护设置配置", sortOrder: 91 },
  { key: "admin.users.view", module: "admin", page: "users", action: "view", label: "用户管理", description: "查看用户管理页面", sortOrder: 100 },
  { key: "admin.users.manage", module: "admin", page: "users", action: "manage", label: "管理用户", description: "创建编辑删除用户", sortOrder: 101 },
  { key: "admin.customer_permissions.view", module: "admin", page: "customer_permissions", action: "view", label: "权限管理", description: "查看统一权限配置页", sortOrder: 102 },
  { key: "admin.customer_permissions.manage", module: "admin", page: "customer_permissions", action: "manage", label: "管理权限", description: "保存重置复制用户权限", sortOrder: 103 },
  { key: "admin.invite_codes.view", module: "admin", page: "invite_codes", action: "view", label: "生成邀请码", description: "查看邀请码列表", sortOrder: 104 },
  { key: "admin.invite_codes.manage", module: "admin", page: "invite_codes", action: "manage", label: "管理邀请码", description: "生成邀请码并维护配置", sortOrder: 105 },
] as const;

export type AppPermissionKey = (typeof APP_PERMISSION_DEFINITIONS)[number]["key"];
export type AppPermissionMap = Record<AppPermissionKey, boolean>;

export const PERMISSION_TEMPLATE_CODES = {
  admin: "admin_full_access",
  staff: "staff_default_access",
  dropshippingCustomer: "dropshipping_customer_default",
} as const;

const STAFF_DEFAULT_PERMISSION_KEYS: AppPermissionKey[] = [
  "dashboard.view",
  "yg_data.view",
  "yg_data.orders.view",
  "yg_data.customers.view",
  "products.view",
  "products.export",
  "inspection.view",
  "inspection.create",
  "inspection.edit",
  "inspection.export",
  "billing.view",
  "billing.create",
  "billing.edit",
  "billing.export",
  "dropshipping.view",
  "dropshipping.overview.view",
  "dropshipping.orders.view",
  "dropshipping.orders.edit",
  "dropshipping.inventory.view",
  "dropshipping.inventory.export",
  "dropshipping.finance.view",
  "dropshipping.finance.export",
  "dropshipping.supplier_misc.view",
  "dropshipping.supplier_misc.edit",
  "dropshipping.supplier_misc.export",
  "pos.view",
  "pos.workbench.view",
  "pos.cashier.view",
  "pos.suspended.view",
  "pos.quote.view",
  "pos.sales_docs.view",
  "pos.returns_void.view",
  "pos.products_prices.view",
  "pos.store_inventory.view",
  "pos.inventory_movement.view",
  "pos.inventory_import.view",
  "pos.transfers.view",
  "pos.finance_stats.view",
  "pos.inventory_stats.view",
  "pos.replenishment.view",
  "pos.audit_logs.view",
  "pos.cashiers.view",
  "pos.store_settings.view",
  "pos.receipt_template.view",
  "pos.system_settings.view",
  "settings.view",
  "settings.manage",
];

const DROPSHIPPING_CUSTOMER_DEFAULT_PERMISSION_KEYS: AppPermissionKey[] = [
  "dropshipping.view",
  "dropshipping.inventory.view",
  "dropshipping.inventory.export",
  "dropshipping.quick_setup.view",
  "dropshipping.quick_setup.edit",
  "dropshipping.quick_setup.store_binding.view",
  "dropshipping.quick_setup.store_binding.edit",
  "dropshipping.quick_setup.product_selection.view",
  "dropshipping.quick_setup.draft_generation.view",
  "dropshipping.quick_setup.draft_generation.create",
];

const STORE_ADMIN_POS_DEFAULT_KEYS: AppPermissionKey[] = [
    "pos.view",
    "pos.workbench.view",
    "pos.cashier.view",
    "pos.suspended.view",
    "pos.quote.view",
    "pos.sales_docs.view",
    "pos.returns_void.view",
    "pos.products_prices.view",
    "pos.label.print",
    "pos.store_inventory.view",
    "pos.inventory_movement.view",
    "pos.inventory_import.view",
    "pos.transfers.view",
    "pos.finance_stats.view",
    "pos.inventory_stats.view",
    "pos.replenishment.view",
    "pos.audit_logs.view",
    "pos.cashiers.view",
    "pos.store_settings.view",
    "pos.receipt_template.view",
    "pos.system_settings.view",
    "pos.sale.view",
    "pos.sale.checkout",
    "pos.sale.refund",
    "pos.sale.export",
    "pos.inventory.view",
    "pos.inventory.adjust",
    "pos.inventory.count",
    "pos.inventory.damage",
    "pos.inventory.import",
    "pos.inventory.export",
    "pos.inventory.movements.view",
    "pos.transfer.view",
    "pos.transfer.create",
    "pos.transfer.send",
    "pos.transfer.receive",
    "pos.report.finance.view",
    "pos.report.inventory.view",
    "pos.replenishment.view",
    "pos.report.export",
    "pos.store.manage",
    "pos.ticket.manage",
    "pos.cashier.manage",
    "pos.audit.view",
  ];

const CASHIER_POS_DEFAULT_KEYS: AppPermissionKey[] = [
    "pos.view",
    "pos.workbench.view",
    "pos.cashier.view",
    "pos.suspended.view",
    "pos.quote.view",
    "pos.sales_docs.view",
    "pos.sale.view",
    "pos.sale.checkout",
  ];

export const POS_CONFIGURABLE_PERMISSION_KEYS: AppPermissionKey[] = [
  "pos.sale.view",
  "pos.sale.refund",
  "pos.sale.export",
  "pos.inventory.view",
  "pos.inventory.adjust",
  "pos.inventory.count",
  "pos.inventory.damage",
  "pos.inventory.import",
  "pos.inventory.export",
  "pos.inventory.movements.view",
  "pos.transfer.view",
  "pos.transfer.create",
  "pos.transfer.send",
  "pos.transfer.receive",
  "pos.report.finance.view",
  "pos.report.inventory.view",
  "pos.replenishment.view",
  "pos.report.export",
  "pos.store.manage",
  "pos.ticket.manage",
  "pos.cashier.manage",
  "pos.audit.view",
  "pos.label.print",
];

const ALL_APP_PERMISSION_KEYS = APP_PERMISSION_DEFINITIONS.map((item) => item.key) as AppPermissionKey[];

export const MODULE_PERMISSION_KEY_MAP = {
  dropshipping: [
    "dropshipping.view",
    "dropshipping.overview.view",
    "dropshipping.orders.view",
    "dropshipping.orders.edit",
    "dropshipping.orders.export",
    "dropshipping.inventory.view",
    "dropshipping.inventory.export",
    "dropshipping.finance.view",
    "dropshipping.finance.export",
    "dropshipping.quick_setup.view",
    "dropshipping.quick_setup.edit",
    "dropshipping.quick_setup.store_binding.view",
    "dropshipping.quick_setup.store_binding.edit",
    "dropshipping.quick_setup.product_selection.view",
    "dropshipping.quick_setup.draft_generation.view",
    "dropshipping.quick_setup.draft_generation.create",
  ],
  pos: [
    "pos.view",
    "pos.workbench.view",
    "pos.cashier.view",
    "pos.suspended.view",
    "pos.quote.view",
    "pos.sales_docs.view",
    "pos.returns_void.view",
    "pos.products_prices.view",
    "pos.store_inventory.view",
    "pos.inventory_movement.view",
    "pos.inventory_import.view",
    "pos.transfers.view",
    "pos.finance_stats.view",
    "pos.inventory_stats.view",
    "pos.replenishment.view",
    "pos.audit_logs.view",
    "pos.cashiers.view",
    "pos.store_settings.view",
    "pos.receipt_template.view",
    "pos.system_settings.view",
    "pos.sale.view",
    "pos.sale.checkout",
    "pos.sale.refund",
    "pos.sale.export",
    "pos.inventory.view",
    "pos.inventory.adjust",
    "pos.inventory.count",
    "pos.inventory.damage",
    "pos.inventory.import",
    "pos.inventory.export",
    "pos.inventory.movements.view",
    "pos.transfer.view",
    "pos.transfer.create",
    "pos.transfer.send",
    "pos.transfer.receive",
    "pos.report.finance.view",
    "pos.report.inventory.view",
    "pos.report.export",
    "pos.audit.view",
    "pos.label.print",
  ],
  inspection: [
    "inspection.view",
    "inspection.create",
    "inspection.edit",
    "inspection.export",
  ],
  billing: [
    "billing.view",
    "billing.create",
    "billing.edit",
    "billing.export",
  ],
  dashboard: [
    "dashboard.view",
  ],
} as const satisfies Record<string, readonly AppPermissionKey[]>;

export type ModulePermissionKey = keyof typeof MODULE_PERMISSION_KEY_MAP;
export const CORE_MODULE_PERMISSION_KEYS = Object.keys(MODULE_PERMISSION_KEY_MAP) as ModulePermissionKey[];
const CORE_MODULE_PERMISSION_KEY_SET = new Set(CORE_MODULE_PERMISSION_KEYS);
const MODULE_ROOT_PERMISSION_KEY_MAP = {
  dropshipping: "dropshipping.view",
  pos: "pos.view",
  inspection: "inspection.view",
  billing: "billing.view",
  dashboard: "dashboard.view",
} as const satisfies Record<ModulePermissionKey, AppPermissionKey>;

const POS_ROLE_DEFAULT_KEYS: Record<PosUserRole, AppPermissionKey[]> = {
  admin_general: [...ALL_APP_PERMISSION_KEYS],
  store_admin: STORE_ADMIN_POS_DEFAULT_KEYS,
  cashier: CASHIER_POS_DEFAULT_KEYS,
};

function emptyAppPermissionMap() {
  return Object.fromEntries(
    ALL_APP_PERMISSION_KEYS.map((key) => [key, false]),
  ) as AppPermissionMap;
}

function permissionMapFromKeys(keys: AppPermissionKey[]) {
  const map = emptyAppPermissionMap();
  for (const key of keys) {
    map[key] = true;
  }
  return map;
}

function getDefaultPosPermissionKeysByRole(session: Pick<Session, "role" | "posRole">): AppPermissionKey[] {
  if (session.role === "admin") return [...ALL_APP_PERMISSION_KEYS];
  const role: PosUserRole = session.posRole === "cashier" ? "cashier" : "store_admin";
  return [...POS_ROLE_DEFAULT_KEYS[role]];
}

export function getDefaultPosActionPermissionKeysByRole(role: PosUserRole) {
  return POS_CONFIGURABLE_PERMISSION_KEYS.filter((key) => POS_ROLE_DEFAULT_KEYS[role].includes(key));
}

function applyPosRoleDefaults(base: AppPermissionMap, session: Pick<Session, "role" | "posRole">) {
  const roleDefaults = new Set(getDefaultPosPermissionKeysByRole(session));
  for (const key of ALL_APP_PERMISSION_KEYS) {
    if (key.startsWith("pos.")) {
      base[key] = roleDefaults.has(key);
    }
  }
  return base;
}

export function isDropshippingCustomerSession(session: Session | null | undefined) {
  return String(session?.userType || "") === "dropshipping_customer";
}

export function getDefaultLandingPath(session: Session | null | undefined) {
  if (!session) return "/login";
  if (
    session.defaultLandingPath &&
    session.defaultLandingPath !== "/login" &&
    session.defaultLandingPath !== "/register"
  ) {
    return session.defaultLandingPath;
  }
  if (isDropshippingCustomerSession(session)) return "/dropshipping?tab=quick_setup";
  return "/dashboard";
}

function canAccessPathByPermissionMap(
  session: Session,
  permissionMap: AppPermissionMap,
  path: string,
) {
  if (!path || path === "/login" || path === "/register") return false;
  if (path === "/account") return true;
  if (path.startsWith("/dashboard")) return Boolean(permissionMap["dashboard.view"]);
  if (path.startsWith("/dropshipping")) return Boolean(permissionMap["dropshipping.view"]);
  if (path.startsWith("/receipts")) return Boolean(permissionMap["inspection.view"]);
  if (path.startsWith("/billing") || path.startsWith("/customer-finance")) {
    return Boolean(permissionMap["billing.view"]);
  }
  if (path.startsWith("/pos")) return Boolean(permissionMap["pos.view"]);
  if (path.startsWith("/products-management")) return Boolean(permissionMap["products.view"]);
  if (path.startsWith("/yg-orders")) {
    return Boolean(permissionMap["yg_data.view"] || permissionMap["yg_data.orders.view"]);
  }
  if (path.startsWith("/yg-customers")) {
    return Boolean(permissionMap["yg_data.view"] || permissionMap["yg_data.customers.view"]);
  }
  if (path.startsWith("/settings")) {
    return Boolean(permissionMap["settings.view"] || permissionMap["settings.manage"] || session.role === "admin");
  }
  if (path.startsWith("/admin/customer-permissions")) {
    return Boolean(
      session.role === "admin" ||
      permissionMap["admin.customer_permissions.view"] ||
      permissionMap["admin.customer_permissions.manage"],
    );
  }
  if (path.startsWith("/admin/users")) {
    return Boolean(
      session.role === "admin" ||
      permissionMap["admin.users.view"] ||
      permissionMap["admin.users.manage"],
    );
  }
  return false;
}

export async function getResolvedLandingPath(session: Session | null | undefined) {
  if (!session) return "/login";

  const permissionMap = await getAppPermissionMap(session);
  const defaultPath = getDefaultLandingPath(session);
  if (canAccessPathByPermissionMap(session, permissionMap, defaultPath)) {
    return defaultPath;
  }

  const candidates = [
    permissionMap["dashboard.view"] ? "/dashboard" : null,
    permissionMap["dropshipping.view"]
      ? (session.dropshippingCustomerId ? "/dropshipping?tab=quick_setup" : "/dropshipping")
      : null,
    permissionMap["inspection.view"] ? "/receipts" : null,
    permissionMap["billing.view"] ? "/billing" : null,
    permissionMap["pos.view"] ? "/pos" : null,
    permissionMap["products.view"] ? "/products-management" : null,
    permissionMap["yg_data.view"] || permissionMap["yg_data.orders.view"] ? "/yg-orders" : null,
    permissionMap["yg_data.view"] || permissionMap["yg_data.customers.view"] ? "/yg-customers" : null,
    permissionMap["settings.view"] || permissionMap["settings.manage"] || session.role === "admin" ? "/settings" : null,
    permissionMap["admin.customer_permissions.view"] || permissionMap["admin.customer_permissions.manage"] || session.role === "admin"
      ? "/admin/customer-permissions"
      : null,
    permissionMap["admin.users.view"] || permissionMap["admin.users.manage"] || session.role === "admin"
      ? "/admin/users"
      : null,
    "/account",
  ].filter((item): item is string => Boolean(item));

  return candidates[0] || "/account";
}

export function getDefaultPermissionTemplateCode(sessionLike: {
  role?: string | null;
  userType?: string | null;
}) {
  if (sessionLike?.role === "admin") return PERMISSION_TEMPLATE_CODES.admin;
  if (sessionLike?.userType === "dropshipping_customer") {
    return PERMISSION_TEMPLATE_CODES.dropshippingCustomer;
  }
  return PERMISSION_TEMPLATE_CODES.staff;
}

export function getDefaultPermissionKeysByTemplateCode(templateCode: string) {
  if (templateCode === PERMISSION_TEMPLATE_CODES.admin) {
    return [...ALL_APP_PERMISSION_KEYS];
  }
  if (templateCode === PERMISSION_TEMPLATE_CODES.dropshippingCustomer) {
    return [...DROPSHIPPING_CUSTOMER_DEFAULT_PERMISSION_KEYS];
  }
  return [...STAFF_DEFAULT_PERMISSION_KEYS];
}

export function getModuleRootPermissionKey(moduleKey: ModulePermissionKey): AppPermissionKey {
  return MODULE_ROOT_PERMISSION_KEY_MAP[moduleKey];
}

export function normalizeModulePermissionKeys(input: unknown): ModulePermissionKey[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((item) => String(item || "").trim())
        .filter((item): item is ModulePermissionKey => CORE_MODULE_PERMISSION_KEY_SET.has(item as ModulePermissionKey)),
    ),
  );
}

export function getPermissionKeysForModule(moduleKey: ModulePermissionKey): AppPermissionKey[] {
  return [...MODULE_PERMISSION_KEY_MAP[moduleKey]];
}

export function buildGrantMapFromModulePermissionKeys(moduleKeys: ModulePermissionKey[]) {
  const normalized = new Set(normalizeModulePermissionKeys(moduleKeys));
  const grantMap = Object.fromEntries(
    ALL_APP_PERMISSION_KEYS.map((key) => [key, false]),
  ) as Record<AppPermissionKey, boolean>;

  for (const moduleKey of normalized) {
    for (const permissionKey of MODULE_PERMISSION_KEY_MAP[moduleKey]) {
      grantMap[permissionKey] = true;
    }
  }

  return grantMap;
}

export function deriveModulePermissionKeysFromPermissionMap(permissionMap: Partial<Record<AppPermissionKey, boolean>>) {
  return CORE_MODULE_PERMISSION_KEYS.filter((moduleKey) =>
    Boolean(permissionMap[MODULE_ROOT_PERMISSION_KEY_MAP[moduleKey]]),
  );
}

export async function getAssignableModulePermissionKeys(session: Session): Promise<ModulePermissionKey[]> {
  if (session.role === "admin") return [...CORE_MODULE_PERMISSION_KEYS];
  const appMap = await getAppPermissionMap(session);
  return CORE_MODULE_PERMISSION_KEYS.filter((moduleKey) =>
    Boolean(appMap[MODULE_ROOT_PERMISSION_KEY_MAP[moduleKey]]),
  );
}

export function buildInviteTemplateCode(inviteCodeId: string) {
  return `invite_${String(inviteCodeId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}

function deriveLegacyPermissionsFromAppMap(appMap: AppPermissionMap): PermissionState {
  return {
    manageSuppliers: Boolean(appMap["settings.manage"]),
    manageProducts: Boolean(appMap["yg_data.view"] || appMap["products.view"]),
    manageCustomers: Boolean(appMap["yg_data.customers.view"] || appMap["billing.view"]),
    exportProductCatalog: Boolean(appMap["products.export"]),
    viewReports: Boolean(
      appMap["dashboard.view"]
      || appMap["dropshipping.view"]
      || appMap["billing.view"],
    ),
    inspectGoods: Boolean(appMap["inspection.view"]),
    importReceipts: Boolean(appMap["inspection.create"] || appMap["inspection.edit"]),
    exportAllData: Boolean(appMap["products.export"] && appMap["billing.export"]),
    viewAllData: Boolean(appMap["yg_data.view"]),
  };
}

function mapLegacyRowToState(row: any): PermissionState {
  return {
    manageSuppliers: row.manage_suppliers,
    manageProducts: row.manage_products,
    manageCustomers: row.manage_customers,
    exportProductCatalog: row.export_product_catalog,
    viewReports: row.view_reports,
    inspectGoods: row.inspect_goods,
    importReceipts: row.import_receipts,
    exportAllData: row.export_all_data,
    viewAllData: row.view_all_data,
  };
}

export async function syncPermissionCatalog() {
  await withPrismaRetry(async () => {
    await prisma.$transaction(async (tx) => {
      for (const definition of APP_PERMISSION_DEFINITIONS) {
        await tx.permissionDefinition.upsert({
          where: { key: definition.key },
          create: {
            key: definition.key,
            module: definition.module,
            page: definition.page,
            action: definition.action,
            label: definition.label,
            description: definition.description,
            sort_order: definition.sortOrder,
          },
          update: {
            module: definition.module,
            page: definition.page,
            action: definition.action,
            label: definition.label,
            description: definition.description,
            sort_order: definition.sortOrder,
          },
        });
      }

      const templates = [
        {
          code: PERMISSION_TEMPLATE_CODES.admin,
          name: "管理员默认权限",
          description: "管理员全权限模板",
          keys: getDefaultPermissionKeysByTemplateCode(PERMISSION_TEMPLATE_CODES.admin),
        },
        {
          code: PERMISSION_TEMPLATE_CODES.staff,
          name: "后台员工默认权限",
          description: "兼容现有后台员工默认权限",
          keys: getDefaultPermissionKeysByTemplateCode(PERMISSION_TEMPLATE_CODES.staff),
        },
        {
          code: PERMISSION_TEMPLATE_CODES.dropshippingCustomer,
          name: "代发客户默认权限",
          description: "邀请码注册代发客户默认权限",
          keys: getDefaultPermissionKeysByTemplateCode(PERMISSION_TEMPLATE_CODES.dropshippingCustomer),
        },
      ];

      for (const template of templates) {
        const savedTemplate = await tx.permissionTemplate.upsert({
          where: { template_code: template.code },
          create: {
            template_code: template.code,
            template_name: template.name,
            description: template.description,
          },
          update: {
            template_name: template.name,
            description: template.description,
          },
        });

        await tx.permissionTemplateItem.deleteMany({
          where: {
            template_id: savedTemplate.id,
            permission_key: { notIn: template.keys },
          },
        });

        for (const key of template.keys) {
          await tx.permissionTemplateItem.upsert({
            where: {
              template_id_permission_key: {
                template_id: savedTemplate.id,
                permission_key: key,
              },
            },
            create: {
              template_id: savedTemplate.id,
              permission_key: key,
              allowed: true,
            },
            update: {
              allowed: true,
            },
          });
        }
      }
    });
  });
}

export async function getAppPermissionMap(session: Session): Promise<AppPermissionMap> {
  if (session.role === "admin") {
    return permissionMapFromKeys([...ALL_APP_PERMISSION_KEYS]);
  }

  const isCustomerOrgMember =
    Boolean(session.dropshippingCustomerId)
    && session.userType !== "dropshipping_customer";
  const base = isCustomerOrgMember
    ? emptyAppPermissionMap()
    : permissionMapFromKeys(
        getDefaultPermissionKeysByTemplateCode(
          getDefaultPermissionTemplateCode({ role: session.role, userType: session.userType }),
        ),
      );
  if (!isCustomerOrgMember) {
    applyPosRoleDefaults(base, session);
  }

  const grants = await withPrismaRetry(() =>
    prisma.userPermissionGrant.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: session.userId,
      },
      select: {
        permission_key: true,
        allowed: true,
      },
    }),
  );

  for (const grant of grants) {
    if (grant.permission_key in base) {
      base[grant.permission_key as AppPermissionKey] = Boolean(grant.allowed);
    }
  }

  const posOverrides = await withPrismaRetry(() =>
    prisma.posUserPermissionOverride.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: session.userId,
      },
      select: {
        permission_key: true,
        effect: true,
      },
    }),
  );

  for (const override of posOverrides) {
    if (!override.permission_key.startsWith("pos.")) continue;
    if (!(override.permission_key in base)) continue;
    base[override.permission_key as AppPermissionKey] = override.effect === "grant";
  }

  return base;
}

export async function hasAppPermission(session: Session, permission: AppPermissionKey) {
  const state = await getAppPermissionMap(session);
  return Boolean(state[permission]);
}

export async function getPermissionState(session: Session): Promise<PermissionState> {
  if (session.role === "admin") return ADMIN_PERMISSIONS;

  if (session.userType === "dropshipping_customer") {
    const appMap = await getAppPermissionMap(session);
    return deriveLegacyPermissionsFromAppMap(appMap);
  }

  const row = await withPrismaRetry(() =>
    prisma.userPermission.findFirst({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: session.userId,
      },
      select: {
        manage_suppliers: true,
        manage_products: true,
        manage_customers: true,
        export_product_catalog: true,
        view_reports: true,
        inspect_goods: true,
        import_receipts: true,
        export_all_data: true,
        view_all_data: true,
      },
    }),
  );

  if (!row) return WORKER_DEFAULT_PERMISSIONS;
  return mapLegacyRowToState(row);
}

export async function hasPermission(session: Session, permission: PermissionKey) {
  const state = await getPermissionState(session);
  return Boolean(state[permission]);
}

export async function replaceUserPermissionGrants(params: {
  tenantId: string;
  companyId: string;
  userId: string;
  grants: Record<string, boolean>;
}) {
  const { tenantId, companyId, userId, grants } = params;
  const managedPermissionKeys = new Set<string>([
    ...ALL_APP_PERMISSION_KEYS,
    CUSTOMER_SETTINGS_PERMISSION_KEYS.view,
    CUSTOMER_SETTINGS_PERMISSION_KEYS.manage,
  ]);
  const normalizedEntries = Object.entries(grants).filter(([key]) =>
    managedPermissionKeys.has(key),
  );

  await withPrismaRetry(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.userPermissionGrant.deleteMany({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          user_id: userId,
          permission_key: {
            in: ALL_APP_PERMISSION_KEYS,
          },
        },
      });

      if (normalizedEntries.length > 0) {
        await tx.userPermissionGrant.createMany({
          data: normalizedEntries.map(([permissionKey, allowed]) => ({
            tenant_id: tenantId,
            company_id: companyId,
            user_id: userId,
            permission_key: permissionKey,
            allowed: Boolean(allowed),
          })),
        });
      }
    });
  });
}

export async function replaceUserModulePermissionGrants(params: {
  tenantId: string;
  companyId: string;
  userId: string;
  moduleKeys: ModulePermissionKey[];
}) {
  const grants = buildGrantMapFromModulePermissionKeys(params.moduleKeys);
  await replaceUserPermissionGrants({
    tenantId: params.tenantId,
    companyId: params.companyId,
    userId: params.userId,
    grants,
  });
}

export async function upsertPermissionTemplateFromModules(params: {
  templateCode: string;
  templateName: string;
  description?: string | null;
  moduleKeys: ModulePermissionKey[];
}) {
  await syncPermissionCatalog();
  const grantMap = buildGrantMapFromModulePermissionKeys(params.moduleKeys);
  const allowedKeys = ALL_APP_PERMISSION_KEYS.filter((key) => grantMap[key]);

  return await withPrismaRetry(async () => {
    return await prisma.$transaction(async (tx) => {
      const template = await tx.permissionTemplate.upsert({
        where: { template_code: params.templateCode },
        create: {
          template_code: params.templateCode,
          template_name: params.templateName,
          description: params.description || null,
        },
        update: {
          template_name: params.templateName,
          description: params.description || null,
        },
      });

      await tx.permissionTemplateItem.deleteMany({
        where: {
          template_id: template.id,
          permission_key: { notIn: allowedKeys },
        },
      });

      for (const permissionKey of allowedKeys) {
        await tx.permissionTemplateItem.upsert({
          where: {
            template_id_permission_key: {
              template_id: template.id,
              permission_key: permissionKey,
            },
          },
          create: {
            template_id: template.id,
            permission_key: permissionKey,
            allowed: true,
          },
          update: {
            allowed: true,
          },
        });
      }

      return template;
    });
  });
}

export async function getModulePermissionKeysByTemplateCode(templateCode: string | null | undefined) {
  const normalizedCode = String(templateCode || "").trim();
  if (!normalizedCode) return [] as ModulePermissionKey[];
  const rows = await withPrismaRetry(() =>
    prisma.permissionTemplateItem.findMany({
      where: {
        template: {
          template_code: normalizedCode,
        },
        allowed: true,
      },
      select: {
        permission_key: true,
      },
    }),
  );
  const permissionMap = Object.fromEntries(
    rows.map((item) => [item.permission_key, true]),
  ) as Partial<Record<AppPermissionKey, boolean>>;
  return deriveModulePermissionKeysFromPermissionMap(permissionMap);
}

export async function applyPermissionTemplateToUser(params: {
  tenantId: string;
  companyId: string;
  userId: string;
  templateCode: string;
}) {
  await syncPermissionCatalog();
  const keys = getDefaultPermissionKeysByTemplateCode(params.templateCode);
  const grants = Object.fromEntries(
    ALL_APP_PERMISSION_KEYS.map((key) => [key, keys.includes(key)]),
  );
  await replaceUserPermissionGrants({
    tenantId: params.tenantId,
    companyId: params.companyId,
    userId: params.userId,
    grants,
  });
}

export async function getUserPermissionPageData(params: {
  tenantId: string;
  companyId: string;
  userId: string;
  role: string;
  userType: string | null | undefined;
  dropshippingCustomerId?: string | null | undefined;
}) {
  await syncPermissionCatalog();

  const defaultTemplateCode = getDefaultPermissionTemplateCode({
    role: params.role,
    userType: params.userType,
  });
  const isCustomerOrgMember = Boolean(params.dropshippingCustomerId) && params.userType !== "dropshipping_customer";
  const defaultMap = isCustomerOrgMember
    ? emptyAppPermissionMap()
    : permissionMapFromKeys(getDefaultPermissionKeysByTemplateCode(defaultTemplateCode));
  if (!isCustomerOrgMember) {
    applyPosRoleDefaults(defaultMap, {
      role: params.role as Session["role"],
      posRole: params.role === "admin" ? "admin_general" : (params.role as Session["posRole"]),
    });
  }
  const defaultKeys = new Set(
    ALL_APP_PERMISSION_KEYS.filter((key) => defaultMap[key]),
  );
  const explicitRows = await withPrismaRetry(() =>
    prisma.userPermissionGrant.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        user_id: params.userId,
      },
      select: {
        permission_key: true,
        allowed: true,
      },
    }),
  );
  const explicitMap = new Map(explicitRows.map((item) => [item.permission_key, Boolean(item.allowed)]));

  return APP_PERMISSION_DEFINITIONS.map((definition) => ({
    key: definition.key,
    module: definition.module,
    page: definition.page,
    action: definition.action,
    label: definition.label,
    description: definition.description || "",
    defaultAllowed: defaultKeys.has(definition.key),
    allowed: explicitMap.has(definition.key)
      ? explicitMap.get(definition.key)
      : defaultKeys.has(definition.key),
    explicitAllowed: explicitMap.has(definition.key) ? explicitMap.get(definition.key) : null,
    sortOrder: definition.sortOrder,
  }));
}

export function getPermissionDefinitionsGrouped() {
  const groups = new Map<string, Array<(typeof APP_PERMISSION_DEFINITIONS)[number]>>();
  for (const definition of APP_PERMISSION_DEFINITIONS) {
    const current = groups.get(definition.module) || [];
    current.push(definition);
    groups.set(definition.module, current);
  }
  return Array.from(groups.entries()).map(([module, items]) => ({
    module,
    items: [...items].sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export function getAppPermissionDefinition(key: AppPermissionKey) {
  return APP_PERMISSION_DEFINITIONS.find((item) => item.key === key) || null;
}
