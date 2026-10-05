# POS_原项目完整审计盘点_第一版

## 一、服务器上原项目 POS 相关目录定位结果

### 1) 已扫描到的仓库与关系
- 运行版混合后台仓库（当前容器构建来源）：
  - `/opt/stacks/parksonim`
  - 证据：`/opt/stacks/parksonim/compose.yaml` 的 `parksonim-app` 使用 `context: .` 构建并映射 `127.0.0.1:13000`
- 并行仓库（同体系分支化演进仓）：
  - `/home/bsdumx/parksonmx-erp`
  - 证据：该目录同样存在 `app/pos`、`app/api/pos`、`components/pos`、`lib/pos`，且远端为 `parksonmx-erp`
- 次要仓库：
  - `/opt/stacks/yogo-sync-agent-review`（未发现 POS 页面/API 主体）

### 2) 旧运行版 POS 主目录（以 `/opt/stacks/parksonim` 为准）
- 页面入口：
  - [app/pos/page.tsx](/opt/stacks/parksonim/app/pos/page.tsx)
  - [app/pos/PosModule.tsx](/opt/stacks/parksonim/app/pos/PosModule.tsx)
- API：
  - [app/api/pos](/opt/stacks/parksonim/app/api/pos)
- 组件：
  - [components/pos](/opt/stacks/parksonim/components/pos)
- 业务层：
  - [lib/pos/services](/opt/stacks/parksonim/lib/pos/services)
  - [lib/pos/server](/opt/stacks/parksonim/lib/pos/server)
  - [lib/pos/repositories](/opt/stacks/parksonim/lib/pos/repositories)
- 权限与角色：
  - [lib/permissions.ts](/opt/stacks/parksonim/lib/permissions.ts)
  - [lib/pos/access.ts](/opt/stacks/parksonim/lib/pos/access.ts)
- 数据模型与迁移：
  - [prisma/schema.prisma](/opt/stacks/parksonim/prisma/schema.prisma)
  - [prisma/migrations](/opt/stacks/parksonim/prisma/migrations)

### 3) 多仓关系结论
- `/opt/stacks/parksonim` 与 `/home/bsdumx/parksonmx-erp` 的 POS 代码主体目录结构一致（`app/pos`、`app/api/pos`、`components/pos`、`lib/pos`）。
- 差异主要在 Prisma 迁移组织：
  - 运行版 `parksonim`：POS 迁移在 `prisma/migrations/...pos_step...`
  - 并行仓 `parksonmx-erp`：存在 `_legacy_parksonim_migrations` 与 wave 迁移并存
- 本文“原项目事实审计”以运行版 `/opt/stacks/parksonim` 为主事实源，并在相关处标注并行仓差异。

---

## 二、POS 页面总清单

### 1) 页面路由入口（真实路由）
- `/pos`（单页模块入口）
  - 文件：[app/pos/page.tsx](/opt/stacks/parksonim/app/pos/page.tsx)

### 2) POS 模块内子页面（Tab）总清单（19个）
来源：`POS_TABS`（[app/pos/PosModule.tsx](/opt/stacks/parksonim/app/pos/PosModule.tsx)）

1. `workbench` 工作台
2. `cashier` 收银台
3. `suspended` 挂起单
4. `quote` 预售报价
5. `sales_docs` 销售单据
6. `returns_void` 退货/作废
7. `products_prices` 商品与价格
8. `store_inventory` 门店库存
9. `inventory_movement` 库存流水
10. `inventory_import` 库存导入
11. `transfers` 门店调拨
12. `finance_stats` 财务统计
13. `inventory_stats` 库存统计
14. `replenishment` 补货建议
15. `audit_logs` 操作日志
16. `cashiers` 收银员管理
17. `store_settings` 门店设置
18. `receipt_template` 小票模板
19. `system_settings` 系统设置

### 3) Tab 实现状态判定
- 已有专用渲染函数：18个（除 `returns_void` 外）
- `returns_void` 当前走通用占位页 `renderGenericPage()`，未见专用业务实现

### 4) 弹窗/模态（PosModalShell）与相关弹层
- `PosModalShell` 在 `PosModule` 内出现 26 处（含选择商品、折扣、挂单、恢复、销售详情、退款确认、库存详情/盘点/报损/调整、调拨创建/详情、小票打印、审计详情、标签打印、错误提示、开业现金、开钱箱、收银解锁、收银员编辑等）
- 小票预览组件：
  - [components/pos/pos-ticket-preview.tsx](/opt/stacks/parksonim/components/pos/pos-ticket-preview.tsx)

### 5) 手机版页面判定
- 未发现独立 POS 手机专用路由（如 `/pos/mobile`、`/m/pos` 等）
- 当前为同一页面通过响应式类适配（Tailwind `md/lg/xl`）

---

## 三、POS 功能总清单（按代码实装盘点）

以下为已在代码中实际找到的业务功能点（按“可执行动作/能力”统计）：

1. POS 模块入口访问控制（`pos.view`）
2. 工作台经营汇总查看
3. 工作台周销售趋势查看
4. 工作台月销售趋势查看
5. 工作台热销商品查看
6. 工作台低库存弹窗查看
7. 收银台商品关键字搜索
8. 收银台条码搜索
9. 收银台商品编号（clave）搜索
10. 收银台分类筛选
11. 收银台分类弹窗选择商品
12. 收银台加购（加入购物车）
13. 收银台改数量
14. 收银台删行
15. 收银台清空整单
16. 单品折扣（金额/百分比）
17. 整单折扣（金额/百分比）
18. 收银台顾客信息录入（姓名/电话/RFC/备注）
19. 支付方式切换（cash/transfer/card）
20. 实收金额录入与找零计算
21. 收银成交（checkout）
22. 收银成功后打印小票
23. 查看小票预览
24. 重打小票
25. 挂单（suspended）
26. 恢复挂单并回填购物车
27. 删除挂单
28. 报价单创建（quote）
29. 报价单删除
30. 报价单转收银
31. 报价批量导入（前端解析 xlsx 后入报价）
32. 销售单列表查询
33. 销售单详情查看
34. 销售单退款
35. 销售数据导出
36. 商品与价格列表查看
37. 商品标签打印（商品页）
38. 门店库存列表查询
39. 库存详情查看
40. 库存调整
41. 库存盘点（final qty）
42. 库存报损
43. 门店库存导出
44. 库存标签打印（库存页）
45. 库存流水查询
46. 库存流水导出
47. 库存导入模板下载
48. 库存导入预校验
49. 库存导入确认入库
50. 门店调拨创建
51. 门店调拨发出
52. 门店调拨收货确认
53. 调拨列表查询
54. 调拨详情查看
55. 财务统计查询（汇总）
56. 支付结构统计查询
57. 销售趋势统计查询
58. 财务统计导出
59. 库存统计查询
60. 库存统计导出
61. 补货建议查询
62. 补货建议导出
63. 审计日志列表查询
64. 审计日志详情查看
65. 审计日志导出
66. 收银员列表查询
67. 收银员新建
68. 收银员编辑
69. 收银员启停状态切换
70. 收银员权限覆盖（grant/deny）
71. 门店设置编辑保存
72. 小票模板设置编辑保存
73. 小票 logo 上传（base64）
74. 系统设置页本地保存提示（当前无后端持久化）
75. 开业现金录入（localStorage）
76. 钱箱开箱密码校验
77. 钱箱接口调用（`window.parksonPos?.openCashDrawer`）
78. 收银台密码解锁/自动关闭（门店配置驱动）

### 未发现或仅占位
- 班次/交班/开班正式台账（未发现独立表/API）
- 会员体系（会员档案、等级、积分、会员价）未发现
- `returns_void` 独立业务实现未发现（当前占位页）

---

## 四、POS 路由与入口总清单

### 1) 页面路由
- `/pos`（主入口）
- `/pos?tab=<tabId>`（19个 tab）

### 2) 导航入口
- 顶部导航由 [components/app-shell.tsx](/opt/stacks/parksonim/components/app-shell.tsx) 注入
- `href: "/pos"`，可见性由 `appPerms["pos.view"]` 控制

### 3) 登录入口与落地
- 登录接口：[app/api/auth/login/route.ts](/opt/stacks/parksonim/app/api/auth/login/route.ts)
- 登录时会读取 `user.pos_role`、`user.pos_store_id` 写入 session 语义
- 落地路径解析由 [lib/permissions.ts](/opt/stacks/parksonim/lib/permissions.ts) 的 `getResolvedLandingPath` 决定

### 4) POS API 路由（51个 route 文件 / 60个 method 端点）
来源：`app/api/pos/**/route.ts`

```text
app/api/pos/audit-logs/[id]/route.ts|GET
app/api/pos/audit-logs/export/route.ts|GET
app/api/pos/audit-logs/route.ts|GET
app/api/pos/cash-drawer/verify/route.ts|POST
app/api/pos/cashiers/[id]/route.ts|GET,PATCH
app/api/pos/cashiers/[id]/status/route.ts|PATCH
app/api/pos/cashiers/route.ts|GET,POST
app/api/pos/checkout/route.ts|POST
app/api/pos/dashboard/summary/route.ts|GET
app/api/pos/inventory-import/commit/route.ts|POST
app/api/pos/inventory-import/preview/route.ts|POST
app/api/pos/inventory-import/template/route.ts|GET
app/api/pos/inventory-movements/export/route.ts|GET
app/api/pos/inventory-movements/route.ts|GET
app/api/pos/inventory/[id]/adjust/route.ts|POST
app/api/pos/inventory/[id]/count/route.ts|POST
app/api/pos/inventory/[id]/damage/route.ts|POST
app/api/pos/inventory/[id]/route.ts|GET
app/api/pos/inventory/export/route.ts|GET
app/api/pos/inventory/route.ts|GET
app/api/pos/products/barcode/[barcode]/route.ts|GET
app/api/pos/products/categories/route.ts|GET
app/api/pos/products/clave/[clave]/route.ts|GET
app/api/pos/products/route.ts|GET
app/api/pos/products/search/route.ts|GET
app/api/pos/quotes/[id]/route.ts|GET,DELETE
app/api/pos/quotes/route.ts|GET,POST
app/api/pos/replenishment-suggestions/export/route.ts|GET
app/api/pos/replenishment-suggestions/route.ts|GET
app/api/pos/reports/finance/export/route.ts|GET
app/api/pos/reports/inventory-overview/route.ts|GET
app/api/pos/reports/inventory/export/route.ts|GET
app/api/pos/reports/payments/route.ts|GET
app/api/pos/reports/sales-trend/route.ts|GET
app/api/pos/reports/top-products/route.ts|GET
app/api/pos/sales/[id]/refund/route.ts|POST
app/api/pos/sales/[id]/route.ts|GET
app/api/pos/sales/[id]/ticket/route.ts|GET
app/api/pos/sales/export/route.ts|GET
app/api/pos/sales/route.ts|GET
app/api/pos/stores/[id]/route.ts|GET,PATCH
app/api/pos/stores/route.ts|GET
app/api/pos/suspended/[id]/resume/route.ts|POST
app/api/pos/suspended/[id]/route.ts|GET,DELETE
app/api/pos/suspended/route.ts|GET,POST
app/api/pos/ticket-settings/[storeId]/route.ts|GET,PATCH
app/api/pos/ticket-settings/route.ts|GET
app/api/pos/transfers/[id]/receive/route.ts|POST
app/api/pos/transfers/[id]/route.ts|GET
app/api/pos/transfers/[id]/send/route.ts|POST
app/api/pos/transfers/route.ts|GET,POST
```

### 5) POS 与 ERP/总台混用入口
- 权限总控页包含 POS 模块权限组：
  - [app/admin/customer-permissions/CustomerPermissionsClient.tsx](/opt/stacks/parksonim/app/admin/customer-permissions/CustomerPermissionsClient.tsx)
- 权限保存接口对 POS 权限一并生效：
  - [app/api/admin/customer-permissions/route.ts](/opt/stacks/parksonim/app/api/admin/customer-permissions/route.ts)

---

## 五、POS 接口与服务层总清单

### 1) Service 层（前端调用封装）
目录：[lib/pos/services](/opt/stacks/parksonim/lib/pos/services)

- 审计：`pos-audit.service.ts`
- 购物车：`pos-cart.service.ts`
- 收银员：`pos-cashiers.service.ts`
- 收银结账：`pos-checkout.service.ts`
- 数据模式：`pos-data-mode.ts`
- 导出：`pos-export.service.ts`
- 单号：`pos-folio.service.ts`
- 库存导入：`pos-inventory-import.service.ts`
- 库存：`pos-inventory.service.ts`
- 支付：`pos-payment.service.ts`
- 商品：`pos-products.service.ts`
- 报价：`pos-quote.service.ts`、`pos-quote-data.service.ts`
- 补货：`pos-replenishment.service.ts`
- 统计：`pos-reports.service.ts`
- 销售/退款：`pos-sales.service.ts`
- 门店：`pos-stores.service.ts`
- 挂单：`pos-suspended.service.ts`、`pos-suspended-data.service.ts`
- 小票：`pos-ticket.service.ts`、`pos-ticket-settings-config.service.ts`
- 调拨：`pos-transfers.service.ts`

### 2) Server 业务层
目录：[lib/pos/server](/opt/stacks/parksonim/lib/pos/server)

- 鉴权守卫：`pos-route.ts`
- 审计：`pos-audit.server.ts`
- 收银员：`pos-cashiers.server.ts`
- 收银结账：`pos-checkout.server.ts`
- 导出构建：`pos-export.server.ts`
- 库存导入：`pos-inventory-import.server.ts`
- 库存：`pos-inventory.server.ts`
- 映射器：`pos-mappers.ts`
- 商品：`pos-products.server.ts`
- 报价：`pos-quotes.server.ts`
- 退款：`pos-refund.server.ts`
- 统计：`pos-reports.server.ts`
- 销售：`pos-sales.server.ts`
- 门店：`pos-stores.server.ts`
- 挂单：`pos-suspended.server.ts`
- 小票模板：`pos-ticket-settings.server.ts`
- 小票：`pos-ticket.server.ts`
- 调拨：`pos-transfers.server.ts`

### 3) Repository 层
目录：[lib/pos/repositories](/opt/stacks/parksonim/lib/pos/repositories)

- `pos-audit.repository.ts`
- `pos-cashiers.repository.ts`
- `pos-inventory.repository.ts`
- `pos-products.repository.ts`
- `pos-quotes.repository.ts`
- `pos-refunds.repository.ts`
- `pos-reports.repository.ts`
- `pos-sales.repository.ts`
- `pos-stores.repository.ts`
- `pos-suspended.repository.ts`
- `pos-ticket-settings.repository.ts`
- `pos-transfers.repository.ts`

### 4) API 权限守卫机制
- 所有 POS API 统一通过 `requirePosSession(...)`（[lib/pos/server/pos-route.ts](/opt/stacks/parksonim/lib/pos/server/pos-route.ts)）
- 能力校验维度：
  - App Permission（`pos.*`）
  - 角色限制（`allowedRoles`）
  - 门店范围（`resolvePosStoreScope` / `ensurePosStoreAccess`）
- 拒绝访问会记录审计日志（denied）

---

## 六、POS 数据表 / 模型 / 字段 / 状态总清单

来源： [prisma/schema.prisma](/opt/stacks/parksonim/prisma/schema.prisma)

### 1) POS 角色/权限相关枚举与用户字段
- `enum PosUserRole`: `admin_general` / `store_admin` / `cashier`
- `enum PosPermissionEffect`: `grant` / `deny`
- `User` 相关字段：
  - `pos_role`
  - `pos_store_id`

### 2) POS 相关模型（15个）

1. `PosUserPermissionOverride`
   - 关键字段：`tenant_id`,`company_id`,`user_id`,`permission_key`,`effect`
2. `PosAuditLog`
   - 关键字段：`action_type`,`module`,`actor_*`,`store_id`,`target_*`,`summary`,`details_json`,`result_status`,`created_at`
3. `PosInventoryMovement`
   - 关键字段：`store_id`,`product_id`,`move_type`,`qty_change`,`qty_before`,`qty_after`,`source_type`,`source_id`,`source_folio`
4. `PosProductConfig`
   - 关键字段：`source_product_id`,`store_id`,`barcode`,`clave`,`name_cn`,`name_es`,`spec`,`pos_price`,`active`,`allow_discount`,`origin`,`importer`,`short_desc`
5. `PosQuoteRecord`
   - 关键字段：`folio`,`store_id`,`cashier_*`,`customer_*`,`subtotal`,`discount_total`,`total`,`status`
6. `PosQuoteLine`
   - 关键字段：`quote_id`,`product_id`,`barcode_snapshot`,`clave_snapshot`,`name_*_snapshot`,`qty`,`unit_price`,`discount_type`,`discount_value`,`subtotal`
7. `PosSaleRecord`
   - 关键字段：`folio`,`store_id`,`source_type`,`source_id`,`cashier_*`,`customer_*`,`subtotal`,`discount_total`,`total`,`payment_method`,`received_amount`,`change_amount`,`status`
8. `PosSaleLine`
   - 关键字段：`sale_record_id`,`product_id`,`barcode_snapshot`,`clave_snapshot`,`name_*_snapshot`,`qty`,`unit_price`,`discount_type`,`discount_value`,`subtotal`
9. `PosRefundRecord`
   - 关键字段：`sale_record_id`,`folio`,`store_id`,`cashier_*`,`reason`,`subtotal`,`discount_total`,`total`
10. `PosRefundLine`
    - 关键字段：`refund_record_id`,`sale_line_id`,`product_id`,`qty`,`unit_price`,`subtotal`
11. `PosStoreInventory`
    - 关键字段：`store_id`,`product_id`,`on_hand_qty`,`reserved_qty`,`available_qty`,`min_stock`,`active`
12. `PosStoreSetting`
    - 关键字段：`store_id`,`store_name`,`store_code`,`address`,`phone`,`rfc`,`active`,`default_ticket_header`,`ticket_subtitle`,`company_full_name`,`cashier_auto_close_enabled`,`cashier_auto_close_minutes`
13. `PosSuspendedOrderRecord`
    - 关键字段：`folio`,`store_id`,`cashier_*`,`customer_*`,`subtotal`,`discount_total`,`total`,`payment_method`,`status`
14. `PosSuspendedOrderLine`
    - 关键字段：`suspended_order_id`,`product_id`,`barcode_snapshot`,`clave_snapshot`,`name_*_snapshot`,`qty`,`unit_price`,`discount_type`,`discount_value`,`subtotal`
15. `PosTicketSetting`
    - 关键字段：`store_id`,`ticket_header_name`,`ticket_header_subtitle`,`address`,`phone`,`rfc`,`footer_line_1`,`footer_line_2`,`show_*`,`logo_url`,`show_ticket_barcode`,`qr_content`,`website`,`whatsapp`
16. `PosTransferRecord`
    - 关键字段：`folio`,`from_store_id`,`to_store_id`,`created_by`,`created_by_name`,`note`,`status`,`sent_at`,`received_at`
17. `PosTransferLine`
    - 关键字段：`transfer_record_id`,`product_id`,`barcode_snapshot`,`clave_snapshot`,`name_*_snapshot`,`qty`

### 3) 代码中可见的 POS 主要状态值
- 销售来源：`direct` / `suspended` / `quote`
- 支付方式：`cash` / `transfer` / `card`
- 挂单状态：`suspended` / `resumed` / `completed`（业务流中出现）
- 报价状态：`draft` / `quoted`
- 销售状态：`completed` / `refunded`
- 调拨状态：`draft` / `sent` / `received` / `canceled`
- 库存状态：`ok` / `low` / `out`
- 库存流水：`sale` / `return` / `adjust` / `import` / `count` / `damage` / `transfer_out` / `transfer_in`
- 审计结果：`success` / `failed` / `denied`
- 导入预览状态：`ready` / `store_not_found` / `identifier_missing` / `product_not_found` / `product_mismatch` / `qty_invalid` / `duplicate`

### 4) POS 迁移文件（运行版）
- `20260406000100_pos_step6_real_data`
- `20260406000200_pos_step7_checkout`
- `20260406000300_pos_step8_inventory`
- `20260406000400_pos_step9_ticket`
- `20260406000500_pos_step10_refund`
- `20260406000600_pos_step14_transfers`
- `20260407043000_pos_step19_scope_roles`
- `20260407050000_pos_step20_audit_logs`
- `20260407070000_pos_step21_store_settings`
- `20260407073000_pos_step22_ticket_fields`
- `20260407090000_pos_step23_permissions_layout_labels`

### 5) 混入其它系统对象的点
- `User` 同时承载通用账号 + POS字段（`pos_role`,`pos_store_id`）
- 统一权限体系 `permission_definitions / user_permission_grants` 与 POS 权限共表
- POS 商品与友购/库存数据耦合在 `pos-products.repository.ts`（`inventory` 与 `yogo` 双源）

---

## 七、POS 权限与角色总清单

### 1) 角色
- `admin_general`
- `store_admin`
- `cashier`

### 2) POS 权限码（`lib/permissions.ts`）
- 模块/页面权限：`pos.view`、`pos.workbench.view`、`pos.cashier.view`、`pos.suspended.view`、`pos.quote.view`、`pos.sales_docs.view`、`pos.returns_void.view`、`pos.products_prices.view`、`pos.store_inventory.view`、`pos.inventory_movement.view`、`pos.inventory_import.view`、`pos.transfers.view`、`pos.finance_stats.view`、`pos.inventory_stats.view`、`pos.replenishment.view`、`pos.audit_logs.view`、`pos.cashiers.view`、`pos.store_settings.view`、`pos.receipt_template.view`、`pos.system_settings.view`
- 动作权限：`pos.sale.checkout`、`pos.sale.view`、`pos.sale.refund`、`pos.sale.export`、`pos.inventory.view`、`pos.inventory.adjust`、`pos.inventory.count`、`pos.inventory.damage`、`pos.inventory.import`、`pos.inventory.export`、`pos.inventory.movements.view`、`pos.transfer.view`、`pos.transfer.create`、`pos.transfer.send`、`pos.transfer.receive`、`pos.report.finance.view`、`pos.report.inventory.view`、`pos.report.export`、`pos.store.manage`、`pos.ticket.manage`、`pos.cashier.manage`、`pos.audit.view`、`pos.label.print`

### 3) 默认角色权限策略
- `admin_general`: 全权限
- `store_admin`: 完整 POS 管理能力（含库存/调拨/报表/收银员/门店/小票/审计）
- `cashier`: 收银核心能力（`cashier/suspended/quote/sales_docs` + `sale.view/sale.checkout`）

### 4) 页面权限与功能权限关系
- 页面可见：由 `pos.*.view` 控制 tab 出现
- 页面内动作：由动作权限（如 `pos.sale.refund`）控制按钮/接口

### 5) 与客户权限关系
- 客户权限后台可配置 POS 模块授权（`admin.customer_permissions.*`）
- POS 权限与 `user_permission_grants`、`pos_user_permission_overrides` 联合生效

---

## 八、POS 界面设计与样式代码定位

### 1) 收银台与 POS 主界面真实生效代码
- 主体： [app/pos/PosModule.tsx](/opt/stacks/parksonim/app/pos/PosModule.tsx)
- 入口： [app/pos/page.tsx](/opt/stacks/parksonim/app/pos/page.tsx)
- 小票可视化： [components/pos/pos-ticket-preview.tsx](/opt/stacks/parksonim/components/pos/pos-ticket-preview.tsx)
- 打印模板 HTML（window.print）： [lib/pos/services/pos-ticket.service.ts](/opt/stacks/parksonim/lib/pos/services/pos-ticket.service.ts)

### 2) POS 公共 UI 组件
- [components/pos/pos-action-bar.tsx](/opt/stacks/parksonim/components/pos/pos-action-bar.tsx)
- [components/pos/pos-data-table-shell.tsx](/opt/stacks/parksonim/components/pos/pos-data-table-shell.tsx)
- [components/pos/pos-empty-state.tsx](/opt/stacks/parksonim/components/pos/pos-empty-state.tsx)
- [components/pos/pos-filter-bar.tsx](/opt/stacks/parksonim/components/pos/pos-filter-bar.tsx)
- [components/pos/pos-modal-shell.tsx](/opt/stacks/parksonim/components/pos/pos-modal-shell.tsx)
- [components/pos/pos-page-header.tsx](/opt/stacks/parksonim/components/pos/pos-page-header.tsx)
- [components/pos/pos-section-card.tsx](/opt/stacks/parksonim/components/pos/pos-section-card.tsx)
- [components/pos/pos-stats-cards.tsx](/opt/stacks/parksonim/components/pos/pos-stats-cards.tsx)

### 3) 样式实现形态
- 无独立 POS CSS/SCSS 文件
- 样式主要来自：
  - `PosModule` 与 `components/pos/*` 内 Tailwind 类
  - [tailwind.config.js](/opt/stacks/parksonim/tailwind.config.js)（`primary`、`secondary-accent`、`shadow-soft` 等）
  - [app/globals.css](/opt/stacks/parksonim/app/globals.css)（全局字体、表格 hover、圆角覆盖等）

### 4) 旧版残留 / 多版本并存判定
- 已确认未被引用残留：
  - [app/pos/demo-data.ts](/opt/stacks/parksonim/app/pos/demo-data.ts)（`rg` 未发现引用）
- 运行中并存机制：
  - `real/mock` 双模式（`NEXT_PUBLIC_POS_DATA_MODE`）
  - 多个 service 在 real 模式请求失败后会回退 mock（例如商品服务），可能导致“看起来可用但数据非真实”
- `returns_void` 存在菜单与权限定义，但无专用渲染函数，当前落入通用占位页

---

## 九、POS 现有问题与混乱点（仅基于代码事实）

1. `returns_void` 页面未实装，当前为占位渲染。
2. `system_settings` 仅前端状态保存提示，未见后端持久化接口。
3. 开业现金使用 `localStorage`，未入库、无审计、无跨端一致性。
4. 未发现班次/开班/交班记录的独立数据模型与接口。
5. 钱箱开启依赖 `window.parksonPos?.openCashDrawer`（外部硬件桥），无设备管理闭环。
6. 未发现会员体系（会员档案/等级/积分/会员价）对应页面/API/表。
7. POS 多服务支持 mock 回退，线上故障场景可能与真实数据混淆。
8. 多仓并存（`parksonim` 与 `parksonmx-erp`）且迁移目录组织不一致，易误判“真实生效版本”。
9. 中西文键值存在不完整对齐：POS 字典 `zh` 比 `es` 多 20 个 key（已识别具体键）。
10. POS 能力与通用权限系统深度耦合，拆分时需要谨慎处理授权来源。

---

## 十、POS 可直接复用 / 部分复用 / 必须重构清单

### A. 可直接复用（事实依据：已全链路打通且结构清晰）
1. POS API 守卫机制（`requirePosSession + role + store scope + audit`）
2. POS 分层结构（`api -> server -> repository`）
3. 销售、挂单、报价、库存、调拨、审计的核心数据模型
4. 导出能力（销售/库存/流水/财务/补货/审计）
5. 小票预览组件与打印服务（含二维码、条码、门店配置）

### B. 可部分复用（需治理后复用）
1. `PosModule.tsx` 单文件体量过大（页面逻辑耦合）：
   - 可复用 UI 结构与业务流程
   - 需拆分模块后再做长期演进
2. 商品服务的 real 失败回退 mock：
   - 可复用 API 调用封装
   - 需去除“隐式 mock 回退”或改为显式策略
3. 收银员权限覆盖模型（override）：
   - 数据结构可复用
   - 需补齐后台权限编排流程与审计可视化
4. 系统设置页：
   - UI 可复用
   - 需补齐后端持久化/版本化

### C. 必须重构（否则会误导新系统）
1. `returns_void` 当前非真实业务页（占位）必须重构为真实流程。
2. 班次/开班/交班/钱箱台账未形成完整后端对象，必须补齐领域模型。
3. 会员能力缺失，若新系统目标含会员收银，必须新建完整域。
4. 开业现金仅本地存储，不满足多端一致性与审计要求，必须重构为后端记录。
5. 多仓迁移组织差异（legacy/wave）若不统一，会持续干扰实施判断，必须先定“唯一权威迁移线”。

---

## 十一、基于原项目事实，对接新项目与中台能力时最值得保留的内容

1. POS 权限语义体系（页面权限 + 动作权限 + 角色默认 + 覆盖）
2. 门店范围控制模型（`allowAllStores` / `defaultStoreId` / scope resolve）
3. 审计日志结构（行为、目标、结果、详情 JSON）
4. 交易链路数据模型（sale/sale_lines/refund/quote/suspended/transfer）
5. 库存流水模型（`qty_before/qty_after/qty_change/source`）
6. 小票模板配置域（门店维度可配置 + 实时预览 + 打印）
7. 导出体系（运营可用性高，适合作为中台报表导出的基础）

---

## 十二、后续进入“新项目 POS 专业统一收口”前还必须先确认的事项

1. 以哪个仓库作为“唯一事实源”（建议锁定运行版 `/opt/stacks/parksonim`，并定义与 `/home/bsdumx/parksonmx-erp` 的同步策略）。
2. POS 数据模式是否强制 `real`（禁用隐式 mock 回退）。
3. `returns_void` 是否列入一期实装（当前仅占位）。
4. 班次/开班/交班/钱箱台账是否纳入一期（当前缺失独立域对象）。
5. 会员域是否纳入一期（当前未发现现成实现）。
6. 系统设置（`system_settings`）是否需要后端持久化与审计。
7. 钱箱硬件接口规范（Web 桥接协议、失败回退、设备鉴权）是否先统一。
8. POS 与通用权限中台的最终边界（谁是权限主数据源）。
9. Prisma 迁移基线与命名规范（legacy 与 wave 的合并策略）。
10. 语言资源治理规则（补齐 POS 西语缺失 key，建立校验流程）。

---

## 附：本次统计口径
- POS 页面数：20（`/pos` 主页面 1 + 模块内 tab 19）
- POS API 接口数：60（按 `HTTP Method + Route` 统计）
- POS 功能点数：78（按“可执行业务动作/能力”统计，见第三节）

