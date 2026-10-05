export function getPosAuditActionLabelKey(actionType: string) {
  switch (actionType) {
    case "checkout_completed":
      return "pos.audit.action.checkout_completed";
    case "refund_completed":
      return "pos.audit.action.refund_completed";
    case "inventory_adjusted":
      return "pos.audit.action.inventory_adjusted";
    case "inventory_counted":
      return "pos.audit.action.inventory_counted";
    case "inventory_damaged":
      return "pos.audit.action.inventory_damaged";
    case "inventory_import_committed":
      return "pos.audit.action.inventory_import_committed";
    case "transfer_created":
      return "pos.audit.action.transfer_created";
    case "transfer_sent":
      return "pos.audit.action.transfer_sent";
    case "transfer_received":
      return "pos.audit.action.transfer_received";
    case "cashier_permission_updated":
      return "pos.audit.action.cashier_permission_updated";
    case "cashier_role_updated":
      return "pos.audit.action.cashier_role_updated";
    case "export_triggered":
      return "pos.audit.action.export_triggered";
    case "access_denied":
      return "pos.audit.action.access_denied";
    default:
      return null;
  }
}

export function getPosAuditModuleLabelKey(module: string) {
  switch (module) {
    case "sale":
      return "pos.audit.module.sale";
    case "inventory":
      return "pos.audit.module.inventory";
    case "transfer":
      return "pos.audit.module.transfer";
    case "cashier":
      return "pos.audit.module.cashier";
    case "export":
      return "pos.audit.module.export";
    case "access":
      return "pos.audit.module.access";
    default:
      return null;
  }
}

export function getPosAuditTargetLabelKey(targetType?: string | null) {
  switch (targetType) {
    case "sale":
      return "pos.audit.target.sale";
    case "refund":
      return "pos.audit.target.refund";
    case "inventory":
      return "pos.audit.target.inventory";
    case "transfer":
      return "pos.audit.target.transfer";
    case "cashier":
      return "pos.audit.target.cashier";
    case "export":
      return "pos.audit.target.export";
    default:
      return null;
  }
}
