import type { AppPermissionKey, AppPermissionMap } from "@/lib/permissions";
import { MODULE_PERMISSION_KEY_MAP } from "@/lib/permissions";

export type CustomerPermissionGroup = {
  key: string;
  title: string;
  items: string[];
  permissionKeys: AppPermissionKey[];
  matchKeys?: AppPermissionKey[];
  defaultPath: string;
};

export const CUSTOMER_PERMISSION_GROUPS: CustomerPermissionGroup[] = [
  {
    key: "dashboard",
    title: "仪表盘",
    items: ["仪表盘"],
    permissionKeys: ["dashboard.view"],
    matchKeys: ["dashboard.view"],
    defaultPath: "/dashboard",
  },
  {
    key: "inspection",
    title: "验货单",
    items: ["验货单"],
    permissionKeys: [...MODULE_PERMISSION_KEY_MAP.inspection],
    matchKeys: ["inspection.view"],
    defaultPath: "/receipts",
  },
  {
    key: "billing",
    title: "账单",
    items: ["账单"],
    permissionKeys: [...MODULE_PERMISSION_KEY_MAP.billing],
    matchKeys: ["billing.view"],
    defaultPath: "/billing",
  },
  {
    key: "pos",
    title: "百盛POS",
    items: ["百盛POS"],
    permissionKeys: [...MODULE_PERMISSION_KEY_MAP.pos],
    matchKeys: ["pos.view"],
    defaultPath: "/pos",
  },
  {
    key: "dropshipping.overview",
    title: "总览",
    items: ["总览"],
    permissionKeys: ["dropshipping.view", "dropshipping.overview.view"],
    matchKeys: ["dropshipping.overview.view"],
    defaultPath: "/dropshipping?tab=overview",
  },
  {
    key: "dropshipping.orders.view",
    title: "订单管理",
    items: ["订单管理"],
    permissionKeys: ["dropshipping.view", "dropshipping.orders.view"],
    matchKeys: ["dropshipping.orders.view"],
    defaultPath: "/dropshipping?tab=orders",
  },
  {
    key: "dropshipping.orders.edit",
    title: "编辑订单",
    items: ["编辑订单"],
    permissionKeys: ["dropshipping.view", "dropshipping.orders.view", "dropshipping.orders.edit"],
    matchKeys: ["dropshipping.orders.edit"],
    defaultPath: "/dropshipping?tab=orders",
  },
  {
    key: "dropshipping.orders.export",
    title: "导出订单",
    items: ["导出订单"],
    permissionKeys: ["dropshipping.view", "dropshipping.orders.view", "dropshipping.orders.export"],
    matchKeys: ["dropshipping.orders.export"],
    defaultPath: "/dropshipping?tab=orders",
  },
  {
    key: "dropshipping.inventory.view",
    title: "已发商品",
    items: ["已发商品"],
    permissionKeys: ["dropshipping.view", "dropshipping.inventory.view"],
    matchKeys: ["dropshipping.inventory.view"],
    defaultPath: "/dropshipping?tab=inventory",
  },
  {
    key: "dropshipping.inventory.export",
    title: "导出已发商品",
    items: ["导出已发商品"],
    permissionKeys: ["dropshipping.view", "dropshipping.inventory.view", "dropshipping.inventory.export"],
    matchKeys: ["dropshipping.inventory.export"],
    defaultPath: "/dropshipping?tab=inventory",
  },
  {
    key: "dropshipping.finance.view",
    title: "财务结算",
    items: ["财务结算"],
    permissionKeys: ["dropshipping.view", "dropshipping.finance.view"],
    matchKeys: ["dropshipping.finance.view"],
    defaultPath: "/dropshipping?tab=finance",
  },
  {
    key: "dropshipping.finance.export",
    title: "导出结算",
    items: ["导出结算"],
    permissionKeys: ["dropshipping.view", "dropshipping.finance.view", "dropshipping.finance.export"],
    matchKeys: ["dropshipping.finance.export"],
    defaultPath: "/dropshipping?tab=finance",
  },
  {
    key: "dropshipping.supplier_misc.view",
    title: "供应商散单记录",
    items: ["供应商散单记录"],
    permissionKeys: ["dropshipping.view", "dropshipping.supplier_misc.view"],
    matchKeys: ["dropshipping.supplier_misc.view"],
    defaultPath: "/dropshipping?tab=finance",
  },
  {
    key: "dropshipping.supplier_misc.edit",
    title: "编辑散单记录",
    items: ["编辑散单记录"],
    permissionKeys: ["dropshipping.view", "dropshipping.supplier_misc.view", "dropshipping.supplier_misc.edit"],
    matchKeys: ["dropshipping.supplier_misc.edit"],
    defaultPath: "/dropshipping?tab=finance",
  },
  {
    key: "dropshipping.supplier_misc.export",
    title: "导出散单记录",
    items: ["导出散单记录"],
    permissionKeys: ["dropshipping.view", "dropshipping.supplier_misc.view", "dropshipping.supplier_misc.export"],
    matchKeys: ["dropshipping.supplier_misc.export"],
    defaultPath: "/dropshipping?tab=finance",
  },
  {
    key: "dropshipping.quick_setup.view",
    title: "代发快捷设置",
    items: ["代发快捷设置"],
    permissionKeys: ["dropshipping.view", "dropshipping.quick_setup.view"],
    matchKeys: ["dropshipping.quick_setup.view"],
    defaultPath: "/dropshipping?tab=quick_setup",
  },
  {
    key: "dropshipping.quick_setup.edit",
    title: "编辑快捷设置",
    items: ["编辑快捷设置"],
    permissionKeys: ["dropshipping.view", "dropshipping.quick_setup.view", "dropshipping.quick_setup.edit"],
    matchKeys: ["dropshipping.quick_setup.edit"],
    defaultPath: "/dropshipping?tab=quick_setup",
  },
  {
    key: "dropshipping.quick_setup.store_binding.view",
    title: "绑定店铺",
    items: ["绑定店铺"],
    permissionKeys: ["dropshipping.view", "dropshipping.quick_setup.view", "dropshipping.quick_setup.store_binding.view"],
    matchKeys: ["dropshipping.quick_setup.store_binding.view"],
    defaultPath: "/dropshipping?tab=quick_setup",
  },
  {
    key: "dropshipping.quick_setup.store_binding.edit",
    title: "编辑店铺绑定",
    items: ["编辑店铺绑定"],
    permissionKeys: [
      "dropshipping.view",
      "dropshipping.quick_setup.view",
      "dropshipping.quick_setup.store_binding.view",
      "dropshipping.quick_setup.store_binding.edit",
    ],
    matchKeys: ["dropshipping.quick_setup.store_binding.edit"],
    defaultPath: "/dropshipping?tab=quick_setup",
  },
  {
    key: "dropshipping.quick_setup.product_selection.view",
    title: "选择产品",
    items: ["选择产品"],
    permissionKeys: ["dropshipping.view", "dropshipping.quick_setup.view", "dropshipping.quick_setup.product_selection.view"],
    matchKeys: ["dropshipping.quick_setup.product_selection.view"],
    defaultPath: "/dropshipping?tab=quick_setup",
  },
  {
    key: "dropshipping.quick_setup.draft_generation.view",
    title: "生成产品草稿",
    items: ["生成产品草稿"],
    permissionKeys: ["dropshipping.view", "dropshipping.quick_setup.view", "dropshipping.quick_setup.draft_generation.view"],
    matchKeys: ["dropshipping.quick_setup.draft_generation.view"],
    defaultPath: "/dropshipping?tab=quick_setup",
  },
  {
    key: "dropshipping.quick_setup.draft_generation.create",
    title: "创建产品草稿",
    items: ["创建产品草稿"],
    permissionKeys: [
      "dropshipping.view",
      "dropshipping.quick_setup.view",
      "dropshipping.quick_setup.draft_generation.view",
      "dropshipping.quick_setup.draft_generation.create",
    ],
    matchKeys: ["dropshipping.quick_setup.draft_generation.create"],
    defaultPath: "/dropshipping?tab=quick_setup",
  },
];

export function getAvailableCustomerPermissionGroups(
  permissionMap: Partial<Record<AppPermissionKey, boolean>>,
) {
  return CUSTOMER_PERMISSION_GROUPS.filter((group) =>
    (group.matchKeys || group.permissionKeys).some((permissionKey) => permissionMap[permissionKey]),
  );
}

export function deriveCustomerPermissionGroupKeys(
  permissionMap: Partial<Record<AppPermissionKey, boolean>>,
) {
  return getAvailableCustomerPermissionGroups(permissionMap)
    .filter((group) =>
      (group.matchKeys || group.permissionKeys).some((permissionKey) => permissionMap[permissionKey]),
    )
    .map((group) => group.key);
}

export function buildCustomerPermissionGrantMap(
  selectedGroupKeys: string[],
  availableGroups: CustomerPermissionGroup[],
) {
  const selectedSet = new Set(selectedGroupKeys);
  const grants: Record<string, boolean> = {};
  for (const group of availableGroups) {
    if (!selectedSet.has(group.key)) continue;
    for (const permissionKey of group.permissionKeys) {
      grants[permissionKey] = true;
    }
  }
  return grants;
}

export function getCustomerPermissionDefaultPath(
  selectedGroupKeys: string[],
  availableGroups: CustomerPermissionGroup[],
) {
  const selectedSet = new Set(selectedGroupKeys);
  const first = availableGroups.find((group) => selectedSet.has(group.key));
  return first?.defaultPath || "/account";
}
