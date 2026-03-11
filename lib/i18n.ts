export type Lang = "zh" | "es";

export const dict: Record<Lang, Record<string, string>> = {
  zh: {
    // =========================
    // App / Common
    // =========================
    "app.title": "ParksonMX 验货平台",
    "app.subtitle": "BS DU S.A. DE C.V.",
    "common.loading": "加载中…",
    "common.saving": "保存中…",
    "common.processing": "处理中…",
    "common.generating": "生成中…",
    "common.search": "搜索",
    "common.search.placeholder": "输入 SKU / 条码 / 名称 进行搜索",
    "common.refresh": "刷新",
    "common.cancel": "取消",
    "common.confirm": "确认",
    "common.close": "关闭",
    "common.back": "返回",
    "common.next": "下一步",
    "common.prev": "上一步",
    "common.save": "保存",
    "common.edit": "编辑",
    "common.update": "更新",
    "common.delete": "删除",
    "common.submit": "提交",
    "common.export": "导出",
    "common.download": "下载",
    "common.upload": "上传",
    "common.copy": "复制",
    "common.copied": "已复制",
    "common.copyFailed": "复制失败，请手动复制",
    "common.yes": "是",
    "common.no": "否",
    "common.all": "全部",
    "common.status": "状态",
    "common.actions": "操作",
    "common.note": "说明",
    "common.optional": "可选",
    "common.required": "必填",
    "common.none": "无",
    "common.na": "-",
    "common.page": "页",
    "common.total": "合计",
    "common.ok": "确定",
    "common.share": "分享",

    // ✅ Status aliases (for code like t(lang, `status.${receipt.status}`))
    "status.pending": "待开始",
    "status.in_progress": "进行中",
    "status.completed": "已完成",

    // Language
    "lang.switch": "语言",
    "lang.zh": "中文",
    "lang.es": "西语",

    // Footer / Legal
    "footer.copyright": "© {year} BS DU S.A. DE C.V. 保留所有权利",
    "footer.product": "ParksonMX 验货平台 {version}",

    // =========================
    // Navigation (Internal)
    // =========================
    "nav.dashboard": "仪表盘",
    "nav.receipts": "验货单管理",
    "nav.scan": "扫码验货",
    "nav.import": "导入验货单",
    "nav.billing": "导出与对账",
    "nav.settings": "系统设置",
    "nav.logout": "退出登录",

    // =========================
    // Auth / Login
    // =========================
    "auth.login.title": "登录",
    "auth.login.subtitle": "内部系统，仅限授权人员使用",
    "auth.login.role": "角色",
    "auth.login.role.admin": "管理员",
    "auth.login.role.worker": "验货员",
    "auth.login.userId": "用户ID",
    "auth.login.userId.placeholder": "例如：admin01 / worker01",
    "auth.login.name": "姓名",
    "auth.login.name.placeholder": "请输入姓名",
    "auth.login.button": "登录",
    "auth.login.error": "登录失败，请检查信息后重试",
    "auth.required": "需要登录才能继续",

    // =========================
    // Dashboard
    // =========================
    "dashboard.title": "验货单管理中心",
    "dashboard.subtitle": "实时监控验货单进度与状态（当前为占位数据）。",
    "dashboard.cards.totalReceipts": "验货单总数",
    "dashboard.cards.pending": "待开始",
    "dashboard.cards.inProgress": "进行中",
    "dashboard.cards.completed": "已完成",
    "dashboard.cards.lastActivity": "最近更新",
    "dashboard.table.title": "最新验货单",
    "dashboard.table.receiptNo": "单号",
    "dashboard.table.supplier": "供应商",
    "dashboard.table.progress": "进度",
    "dashboard.table.updatedAt": "更新时间",
    "dashboard.noteTitle": "提示",
    "dashboard.noteDesc":
      "当前版本先保证系统可部署运行；统计汇总会在补齐数据库迁移后启用真实数据。",

    // =========================
    // Receipts List
    // =========================
    "receipts.title": "验货单管理",
    "receipts.create": "新建验货单",
    "receipts.import": "导入 Excel",
    "receipts.filter.status": "按状态筛选",
    "receipts.filter.supplier": "按供应商筛选",
    "receipts.table.receiptNo": "单号",
    "receipts.table.supplier": "供应商",
    "receipts.table.items": "SKU数",
    "receipts.table.progress": "进度",
    "receipts.table.status": "状态",
    "receipts.table.updatedAt": "更新时间",
    "receipts.table.open": "打开",
    "receipts.empty": "暂无验货单",

    // Receipt Status (备用：如果你页面用 receipt.status.*)
    "receipt.status.pending": "待开始",
    "receipt.status.in_progress": "进行中",
    "receipt.status.completed": "已完成",
    "receipt.locked": "已锁定不可修改",

    // =========================
    // Receipt Detail (Admin Monitor)
    // =========================
    "receipt.detail.title": "验货单详情",
    "receipt.detail.summary": "汇总",
    "receipt.detail.receiptNo": "验货单号",
    "receipt.detail.supplier": "供应商",
    "receipt.detail.progress": "进度",
    "receipt.detail.totalItems": "SKU总数",
    "receipt.detail.completedItems": "已完成SKU",
    "receipt.detail.lastActivity": "最近更新",
    "receipt.detail.actions.scan": "进入扫码验货",
    "receipt.detail.actions.export": "导出结果",
    "receipt.detail.actions.evidence": "验货证据",
    "receipt.detail.section.items": "SKU 列表",
    "receipt.detail.section.unexpected": "非清单到货商品",
    "receipt.detail.section.logs": "操作日志",
    "receipt.detail.deltaTip": "页面每 3 秒自动更新（增量）",

    // =========================
    // Scan Workbench
    // =========================
    "scan.title": "扫码验货工作台",
    "scan.input.label": "扫码枪输入（条码/ SKU）",
    "scan.input.placeholder": "请扫码或输入条码 / SKU，然后回车",
    "scan.input.hint": "输入框会自动保持焦点，扫码后自动提交",
    "scan.notFound": "未在验货单中找到该商品，已加入“非清单到货商品”",
    "scan.success": "已更新",
    "scan.error": "操作失败，请重试",
    "scan.locked": "该验货单已锁定，无法修改",
    "scan.versionConflict": "数据已被他人更新，请刷新后再试",
    "scan.section.expected": "清单商品",
    "scan.section.unexpected": "非清单到货商品",
    "scan.unexpected.note": "非清单商品不定价，仅记录 SKU/条码/数量",

    // ReceiptItem fields / columns (scan table)
    "item.col.image": "图片",
    "item.col.sku": "SKU",
    "item.col.barcode": "条码",
    "item.col.nameZh": "中文名",
    "item.col.nameEs": "西文名",
    "item.col.casePack": "中包数",
    "item.col.qtyTotal": "商品数量",
    "item.col.sellPrice": "卖价",
    "item.col.discount": "折扣",
    "item.col.lineTotal": "金额合计",
    "item.col.goodQty": "良品",
    "item.col.damagedQty": "破损",
    "item.col.diffQty": "相差",
    "item.col.overQty": "超收",
    "item.col.status": "验货状态",
    "item.col.actions": "编辑",

    // Item status
    "item.status.pending": "待验",
    "item.status.in_progress": "验货中",
    "item.status.completed": "已完成",

    // Item edit
    "item.edit.title": "编辑商品信息",
    "item.edit.sku": "SKU",
    "item.edit.barcode": "条码",
    "item.edit.casePack": "中包数",
    "item.edit.sellPrice": "卖价",
    "item.edit.save": "保存修改",
    "item.edit.cancel": "取消",
    "item.edit.locked": "已锁定不可编辑",

    // =========================
    // Evidence (Receipt-level photos 1–50)
    // =========================
    "evidence.title": "验货证据",
    "evidence.subtitle": "每份验货单需上传 1–50 张照片，永久保留",
    "evidence.upload": "上传照片",
    "evidence.upload.hint": "支持多选，建议清晰拍摄箱体/托盘/破损位置/签收单等",
    "evidence.count": "已上传：{count} 张",
    "evidence.limit": "最多 50 张",
    "evidence.required": "至少上传 1 张才能完成验货单",
    "evidence.preview": "预览",
    "evidence.empty": "暂无证据照片",
    "evidence.publicLink": "公开证据链接",
    "evidence.copyPublicLink": "复制公开链接",
    "evidence.copied": "公开链接已复制",

    // Public Evidence page
    "public.evidence.title": "验货证据公开查看",
    "public.evidence.receiptNo": "验货单号",
    "public.evidence.supplier": "供应商",
    "public.evidence.photos": "证据照片",
    "public.evidence.noPricingNote":
      "公开页面仅展示证据，不展示价格/折扣/金额等商业信息。",

    // =========================
    // Import Wizard (Validate -> Commit)
    // =========================
    "import.title": "导入验货单",
    "import.step.upload": "上传文件",
    "import.step.validate": "校验结果",
    "import.step.commit": "提交导入",
    "import.file.choose": "选择 Excel 文件（xls/xlsx）",
    "import.file.selected": "已选择文件：{name}",
    "import.validate": "开始校验",
    "import.validating": "正在校验…",
    "import.commit": "提交导入",
    "import.committing": "正在提交…",
    "import.success": "导入成功",
    "import.fail": "导入失败",
    "import.rollback": "导入失败已整体回滚",
    "import.errors.title": "错误列表",
    "import.errors.row": "行号",
    "import.errors.field": "字段",
    "import.errors.message": "原因",
    "import.preview.title": "预览",
    "import.requiredColumns":
      "必需字段：SKU、条码、中文名、西文名、中包数、商品总数量、商品卖价、折扣、金额合计",

    // =========================
    // Export / Billing (Merge Master)
    // =========================
    "billing.title": "对账与账单",
    "billing.subtitle": "合并多个验货单生成总账单，并支持分享与下载。",
    "billing.notReadyTitle": "功能准备中",
    "billing.notReadyDesc":
      "当前版本先保证系统可部署运行；总账单（MasterReceipt）与分享下载将在补齐数据库迁移后启用。",
    "billing.receipts.select": "选择要合并的验货单（已完成）",
    "billing.master.create": "生成总账单",
    "billing.master.no": "总账单号",
    "billing.master.created": "总账单已生成",
    "billing.master.download": "下载总账单 (XLSX)",
    "billing.master.publicShare": "顾客公开查看链接",
    "billing.master.copyLink": "复制链接",
    "billing.master.copied": "链接已复制",
    "billing.master.shareWhatsapp": "WhatsApp 分享",
    "billing.master.shareWechat": "微信分享（复制链接）",
    "billing.master.revoke": "撤销分享链接",
    "billing.master.revoked": "分享链接已撤销",
    "billing.notice.unexpected": "非清单到货商品不定价，金额列为空",

    // Receipt export
    "export.receipt.title": "导出验货单结果",
    "export.receipt.download": "下载验货单 (XLSX)",

    // =========================
    // Public Master (Share)
    // =========================
    "public.master.title": "总账单公开查看",
    "public.master.linkedReceipts": "关联验货单",
    "public.master.th.receiptNo": "单号",
    "public.master.th.supplier": "供应商",
    "public.master.th.status": "状态",
    "public.master.downloadXlsx": "下载完整结算单 (XLSX)",
    "public.master.noPricingNote": "公开页面不展示内部日志与敏感信息。",
    "public.master.copyLink": "复制链接",
    "public.master.copied": "链接已复制",
    "public.master.copyFailed": "复制失败，请手动复制地址栏链接",
    "public.master.shareWhatsapp": "WhatsApp 分享",
    "public.master.shareWechat": "微信分享",
    "public.master.wechatHint": "链接已复制，请粘贴到微信发送",
    "public.master.notReadyTitle": "公开总账单准备中",
    "public.master.notReadyDesc":
      "当前版本先保证系统可部署运行；总账单分享与下载会在补齐数据库迁移后启用。",

    // =========================
    // Settings
    // =========================
    "settings.title": "系统设置",
    "settings.users": "用户管理",
    "settings.users.add": "新增用户",
    "settings.users.role": "角色",
    "settings.users.name": "姓名",
    "settings.users.active": "启用",
    "settings.users.disabled": "禁用",
    "settings.tenancy": "租户与公司",
    "settings.company": "公司",
    "settings.tenant": "租户",

    // =========================
    // Errors (API / UI)
    // =========================
    "error.IDEMPOTENCY_KEY_REQUIRED": "缺少 Idempotency-Key，请重试",
    "error.VERSION_CONFLICT": "数据冲突：已被他人更新，请刷新后再试",
    "error.LOCKED": "已锁定不可修改",
    "error.FORBIDDEN": "无权限",
    "error.NOT_FOUND": "未找到",
    "error.VALIDATION_FAILED": "校验失败",
    "error.INTERNAL_ERROR": "系统错误，请稍后再试",
  },

  es: {
    // =========================
    // App / Common
    // =========================
    "app.title": "Plataforma de Inspección ParksonMX",
    "app.subtitle": "BS DU S.A. DE C.V.",
    "common.loading": "Carg…",
    "common.saving": "Guard…",
    "common.processing": "Proc…",
    "common.generating": "Gen…",
    "common.search": "Buscar",
    "common.search.placeholder": "Buscar por SKU / código de barras / nombre",
    "common.refresh": "Act.",
    "common.cancel": "Canc.",
    "common.confirm": "Conf.",
    "common.close": "Cerrar",
    "common.back": "Atrás",
    "common.next": "Sig.",
    "common.prev": "Ant.",
    "common.save": "Guar.",
    "common.edit": "Editar",
    "common.update": "Act.",
    "common.delete": "Elim.",
    "common.submit": "Enviar",
    "common.export": "Exportar",
    "common.download": "Desc.",
    "common.upload": "Sub.",
    "common.copy": "Copiar",
    "common.copied": "Copiado",
    "common.copyFailed": "No se pudo copiar. Copia manualmente.",
    "common.yes": "Sí",
    "common.no": "No",
    "common.all": "Todos",
    "common.status": "Estado",
    "common.actions": "Acc.",
    "common.note": "Nota",
    "common.optional": "Opcional",
    "common.required": "Req.",
    "common.none": "Ninguno",
    "common.na": "-",
    "common.page": "Pág.",
    "common.total": "Total",
    "common.ok": "OK",
    "common.share": "Compartir",

    // ✅ Status aliases (for code like t(lang, `status.${receipt.status}`))
    "status.pending": "Pendiente",
    "status.in_progress": "En proceso",
    "status.completed": "Completada",

    // Language
    "lang.switch": "Lang",
    "lang.zh": "Chino",
    "lang.es": "Español",

    // Footer / Legal
    "footer.copyright":
      "© {year} BS DU S.A. DE C.V. Todos los derechos reservados",
    "footer.product": "ParksonMX Plataforma {version}",

    // =========================
    // Navigation (Internal)
    // =========================
    "nav.dashboard": "Dash",
    "nav.receipts": "Rec",
    "nav.scan": "Scan",
    "nav.import": "Imp",
    "nav.billing": "Bill",
    "nav.settings": "Cfg",
    "nav.logout": "Out",

    // =========================
    // Auth / Login
    // =========================
    "auth.login.title": "Iniciar sesión",
    "auth.login.subtitle": "Sistema interno. Solo personal autorizado.",
    "auth.login.role": "Rol",
    "auth.login.role.admin": "Administrador",
    "auth.login.role.worker": "Operador",
    "auth.login.userId": "ID de usuario",
    "auth.login.userId.placeholder": "Ej: admin01 / worker01",
    "auth.login.name": "Nombre",
    "auth.login.name.placeholder": "Ingresa tu nombre",
    "auth.login.button": "Entrar",
    "auth.login.error": "Error al iniciar sesión. Intenta de nuevo.",
    "auth.required": "Se requiere iniciar sesión",

    // =========================
    // Dashboard
    // =========================
    "dashboard.title": "Panel",
    "dashboard.subtitle": "Monitorea el progreso (datos temporales).",
    "dashboard.cards.totalReceipts": "Total de recepciones",
    "dashboard.cards.pending": "Pendientes",
    "dashboard.cards.inProgress": "En proceso",
    "dashboard.cards.completed": "Completadas",
    "dashboard.cards.lastActivity": "Última actividad",
    "dashboard.table.title": "Recepciones recientes",
    "dashboard.table.receiptNo": "N°",
    "dashboard.table.supplier": "Proveedor",
    "dashboard.table.progress": "Progreso",
    "dashboard.table.updatedAt": "Actualizado",
    "dashboard.noteTitle": "Nota",
    "dashboard.noteDesc":
      "Primero aseguramos el despliegue; las métricas reales se activarán tras completar migraciones.",

    // =========================
    // Receipts List
    // =========================
    "receipts.title": "Recepciones",
    "receipts.create": "Nueva recepción",
    "receipts.import": "Importar Excel",
    "receipts.filter.status": "Filtrar por estado",
    "receipts.filter.supplier": "Filtrar por proveedor",
    "receipts.table.receiptNo": "N°",
    "receipts.table.supplier": "Proveedor",
    "receipts.table.items": "SKUs",
    "receipts.table.progress": "Progreso",
    "receipts.table.status": "Estado",
    "receipts.table.updatedAt": "Actualizado",
    "receipts.table.open": "Abrir",
    "receipts.empty": "No hay recepciones",

    // Receipt Status (备用)
    "receipt.status.pending": "Pendiente",
    "receipt.status.in_progress": "En proceso",
    "receipt.status.completed": "Completada",
    "receipt.locked": "Bloqueado: no se puede editar",

    // =========================
    // Receipt Detail (Admin Monitor)
    // =========================
    "receipt.detail.title": "Detalle de recepción",
    "receipt.detail.summary": "Resumen",
    "receipt.detail.receiptNo": "N° de recepción",
    "receipt.detail.supplier": "Proveedor",
    "receipt.detail.progress": "Progreso",
    "receipt.detail.totalItems": "Total SKUs",
    "receipt.detail.completedItems": "SKUs completados",
    "receipt.detail.lastActivity": "Última actividad",
    "receipt.detail.actions.scan": "Ir a escaneo",
    "receipt.detail.actions.export": "Exportar",
    "receipt.detail.actions.evidence": "Evidencia",
    "receipt.detail.section.items": "Lista de SKUs",
    "receipt.detail.section.unexpected": "Artículos fuera de lista",
    "receipt.detail.section.logs": "Registro de acciones",
    "receipt.detail.deltaTip": "Actualización automática cada 3 segundos (delta)",

    // =========================
    // Scan Workbench
    // =========================
    "scan.title": "Estación de Escaneo",
    "scan.input.label": "Entrada por escáner (código/SKU)",
    "scan.input.placeholder": "Escanea o escribe y presiona Enter",
    "scan.input.hint": "El campo mantiene el foco y envía automáticamente",
    "scan.notFound": "No está en la lista. Se agregó a “Artículos fuera de lista”.",
    "scan.success": "Actualizado",
    "scan.error": "Error. Intenta de nuevo.",
    "scan.locked": "La recepción está bloqueada. No se puede modificar.",
    "scan.versionConflict":
      "Conflicto: se actualizó por otro usuario. Refresca e intenta de nuevo.",
    "scan.section.expected": "Artículos de lista",
    "scan.section.unexpected": "Artículos fuera de lista",
    "scan.unexpected.note":
      "Los artículos fuera de lista no tienen precio; solo SKU/código/cantidad",

    // ReceiptItem fields / columns
    "item.col.image": "Imagen",
    "item.col.sku": "SKU",
    "item.col.barcode": "Código",
    "item.col.nameZh": "Nombre (ZH)",
    "item.col.nameEs": "Nombre (ES)",
    "item.col.casePack": "Caja/Pack",
    "item.col.qtyTotal": "Cantidad",
    "item.col.sellPrice": "Precio",
    "item.col.discount": "Descuento",
    "item.col.lineTotal": "Importe",
    "item.col.goodQty": "Bueno",
    "item.col.damagedQty": "Dañado",
    "item.col.diffQty": "Diferencia",
    "item.col.overQty": "Sobrante",
    "item.col.status": "Estado",
    "item.col.actions": "Editar",

    // Item status
    "item.status.pending": "Pendiente",
    "item.status.in_progress": "En proceso",
    "item.status.completed": "Completado",

    // Item edit
    "item.edit.title": "Editar artículo",
    "item.edit.sku": "SKU",
    "item.edit.barcode": "Código",
    "item.edit.casePack": "Caja/Pack",
    "item.edit.sellPrice": "Precio",
    "item.edit.save": "Guardar",
    "item.edit.cancel": "Cancelar",
    "item.edit.locked": "Bloqueado: no editable",

    // =========================
    // Evidence
    // =========================
    "evidence.title": "Evidencia",
    "evidence.subtitle":
      "Cada recepción requiere 1–50 fotos. Se guardan permanentemente.",
    "evidence.upload": "Subir fotos",
    "evidence.upload.hint":
      "Se recomienda fotos claras de cajas/pallets/daños/documentos",
    "evidence.count": "Subidas: {count}",
    "evidence.limit": "Máximo 50",
    "evidence.required": "Se requiere al menos 1 foto para completar",
    "evidence.preview": "Vista previa",
    "evidence.empty": "Sin evidencia",
    "evidence.publicLink": "Enlace público de evidencia",
    "evidence.copyPublicLink": "Copiar enlace público",
    "evidence.copied": "Enlace copiado",

    // Public Evidence
    "public.evidence.title": "Ver Evidencia (Público)",
    "public.evidence.receiptNo": "N° de recepción",
    "public.evidence.supplier": "Proveedor",
    "public.evidence.photos": "Fotos",
    "public.evidence.noPricingNote":
      "La página pública solo muestra evidencia; no muestra precio/descuento/importe.",

    // =========================
    // Import Wizard
    // =========================
    "import.title": "Importar recepción",
    "import.step.upload": "Subir",
    "import.step.validate": "Validar",
    "import.step.commit": "Confirmar",
    "import.file.choose": "Seleccionar Excel (xls/xlsx)",
    "import.file.selected": "Archivo: {name}",
    "import.validate": "Validar",
    "import.validating": "Validando…",
    "import.commit": "Confirmar importación",
    "import.committing": "Confirmando…",
    "import.success": "Importación exitosa",
    "import.fail": "Falló la importación",
    "import.rollback": "Falló y se revirtió todo",
    "import.errors.title": "Errores",
    "import.errors.row": "Fila",
    "import.errors.field": "Campo",
    "import.errors.message": "Motivo",
    "import.preview.title": "Vista previa",
    "import.requiredColumns":
      "Campos requeridos: SKU, código, nombre ZH, nombre ES, pack, cantidad, precio, descuento, importe",

    // =========================
    // Export / Billing (Merge Master)
    // =========================
    "billing.title": "Facturación y Cuenta",
    "billing.subtitle":
      "Combina varias recepciones para generar una factura maestra y compartir/descargar.",
    "billing.notReadyTitle": "Función en preparación",
    "billing.notReadyDesc":
      "En esta versión primero aseguramos el despliegue; la factura maestra (MasterReceipt) se activará después de completar las migraciones.",
    "billing.receipts.select": "Selecciona recepciones completadas para combinar",
    "billing.master.create": "Generar liquidación total",
    "billing.master.no": "N° de liquidación",
    "billing.master.created": "Liquidación creada",
    "billing.master.download": "Descargar (XLSX)",
    "billing.master.publicShare": "Enlace público para el cliente",
    "billing.master.copyLink": "Copiar enlace",
    "billing.master.copied": "Enlace copiado",
    "billing.master.shareWhatsapp": "Compartir por WhatsApp",
    "billing.master.shareWechat": "Compartir en WeChat (copiar enlace)",
    "billing.master.revoke": "Revocar enlace",
    "billing.master.revoked": "Enlace revocado",
    "billing.notice.unexpected":
      "Los artículos fuera de lista no tienen precio; las columnas de importe quedan vacías",

    // Receipt export
    "export.receipt.title": "Exportar recepción",
    "export.receipt.download": "Descargar recepción (XLSX)",

    // =========================
    // Public Master (Share)
    // =========================
    "public.master.title": "Ver Liquidación Total (Público)",
    "public.master.linkedReceipts": "Recepciones Vinculadas",
    "public.master.th.receiptNo": "N°",
    "public.master.th.supplier": "Proveedor",
    "public.master.th.status": "Estado",
    "public.master.downloadXlsx": "Descargar Liquidación Completa (XLSX)",
    "public.master.noPricingNote":
      "La página pública no muestra registros internos ni info sensible.",
    "public.master.copyLink": "Copiar enlace",
    "public.master.copied": "Enlace copiado",
    "public.master.copyFailed":
      "No se pudo copiar. Copia el enlace desde la barra de direcciones.",
    "public.master.shareWhatsapp": "Compartir por WhatsApp",
    "public.master.shareWechat": "Compartir en WeChat",
    "public.master.wechatHint":
      "Enlace copiado. Pégalo en WeChat para enviarlo.",
    "public.master.notReadyTitle": "Factura pública en preparación",
    "public.master.notReadyDesc":
      "Primero aseguramos el despliegue; el enlace público y la descarga se activarán tras completar migraciones.",

    // =========================
    // Settings
    // =========================
    "settings.title": "Configuración",
    "settings.users": "Usuarios",
    "settings.users.add": "Agregar usuario",
    "settings.users.role": "Rol",
    "settings.users.name": "Nombre",
    "settings.users.active": "Activo",
    "settings.users.disabled": "Inactivo",
    "settings.tenancy": "Tenant/Compañía",
    "settings.company": "Compañía",
    "settings.tenant": "Tenant",

    // =========================
    // Errors (API / UI)
    // =========================
    "error.IDEMPOTENCY_KEY_REQUIRED":
      "Falta Idempotency-Key. Intenta de nuevo.",
    "error.VERSION_CONFLICT":
      "Conflicto: actualizado por otro usuario. Refresca e intenta de nuevo.",
    "error.LOCKED": "Bloqueado: no se puede modificar.",
    "error.FORBIDDEN": "Sin permiso.",
    "error.NOT_FOUND": "No encontrado.",
    "error.VALIDATION_FAILED": "Validación fallida.",
    "error.INTERNAL_ERROR": "Error del sistema. Intenta más tarde.",
  },
};

export function t(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>
): string {
  const template = dict[lang]?.[key];
  // ✅ No cross-language fallback to avoid mixed-language pages.
  const raw = template ?? `[MISSING:${key}]`;

  if (!vars) return raw;

  // Simple {var} interpolation
  return raw.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = vars[k];
    return v === undefined ? `{${k}}` : String(v);
  });
}
