"use client";

import { useEffect, useMemo, useState } from "react";

type Lang = "zh" | "es";

type UserItem = {
  id: string;
  userId?: string | null;
  name: string;
  nameZh?: string | null;
  nameEn?: string | null;
  phone: string;
  email: string | null;
  remark?: string | null;
  dataSource?: string | null;
  avatarUrl: string | null;
  role: "admin" | "worker";
  userType: "staff" | "dropshipping_customer";
  dropshippingCustomerId?: string | null;
  customerOrgRole?: "owner" | "manager" | "staff" | null;
  customerName?: string | null;
  customDomain?: string | null;
  customDomainEnabled?: boolean;
  defaultAccessUrl?: string | null;
  domainStatus?: string | null;
  active: boolean;
  defaultLandingPath: string | null;
  inviteRegistered: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

type PermissionItem = {
  key: string;
  module: string;
  page: string;
  action: string;
  label: string;
  description: string;
  allowed: boolean;
  defaultAllowed: boolean;
  explicitAllowed: boolean | null;
  sortOrder: number;
};

type TemplateItem = {
  code: string;
  name: string;
};

type InviteCodeItem = {
  id: string;
  code: string;
  status: "active" | "disabled" | "expired";
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  remark: string;
  moduleKeys?: string[];
  used?: boolean;
  relatedAccounts?: Array<{
    id: string;
    account: string;
    name: string;
    phone: string;
    email: string | null;
    usedAt: string;
  }>;
  createdAt: string;
};

type ModuleKey = "dropshipping" | "pos" | "inspection" | "billing" | "dashboard";

function groupPermissions(items: PermissionItem[]) {
  const groups = new Map<string, PermissionItem[]>();
  for (const item of items) {
    const current = groups.get(item.module) || [];
    current.push(item);
    groups.set(item.module, current);
  }
  return Array.from(groups.entries()).map(([module, rows]) => ({
    module,
    rows: [...rows].sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

function groupUsers(items: UserItem[]) {
  const internal = items.filter((item) => item.userType !== "dropshipping_customer");
  const customers = items.filter((item) => item.userType === "dropshipping_customer");
  return { internal, customers };
}

function fmtTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function UserAvatar({ user }: { user: UserItem }) {
  const initials = String(user.name || user.phone || "U").trim().slice(0, 1).toUpperCase();
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt={user.name || "avatar"}
      className="h-10 w-10 rounded-full border border-slate-200 object-cover"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
      {initials}
    </div>
  );
}

function canDeleteUser(user: UserItem | null) {
  if (!user) return false;
  return !(user.role === "admin" && user.userType !== "dropshipping_customer");
}

function getPermissionGroupTitle(moduleKey: string) {
  const normalized = String(moduleKey || "").toLowerCase();
  const titleMap: Record<string, string> = {
    dashboard: "仪表盘",
    yg_data: "友购数据",
    products: "产品",
    inspection: "验货单",
    billing: "账单",
    dropshipping: "一件代发",
    pos: "百盛POS",
    settings: "设置",
    admin: "后台管理",
  };
  return titleMap[normalized] || moduleKey.replace(/_/g, " ");
}

function getPermissionGridClass(count: number) {
  if (count <= 1) return "grid gap-3";
  if (count <= 4) return "grid gap-3 md:grid-cols-2";
  return "grid gap-3 md:grid-cols-2 2xl:grid-cols-3";
}

function getPermissionSectionClass(count: number, embedded: boolean) {
  const base = embedded
    ? "rounded-xl border border-slate-200 bg-white p-5"
    : "rounded-2xl border border-slate-200 bg-white p-5 shadow-soft";

  if (count >= 8) return `${base} xl:col-span-2 2xl:col-span-3`;
  if (count >= 5) return `${base} xl:col-span-2 2xl:col-span-2`;
  return base;
}

function getDataSourceLabel(source: string | null | undefined, text: {
  sourceInvite: string;
  sourceCustomer: string;
  sourcePlatform: string;
}) {
  if (source === "invite_registered") return text.sourceInvite;
  if (source === "customer_created") return text.sourceCustomer;
  return text.sourcePlatform;
}

export function CustomerPermissionsClient({
  lang,
  initialUsers = [],
  initialSelectedUser = null,
  initialPermissions = [],
  templates = [],
  autoload = false,
  embedded = false,
  canManagePermissions = true,
  canViewInviteCodes = true,
  canManageInviteCodes = true,
  preferredUserId = "",
}: {
  lang: Lang;
  initialUsers?: UserItem[];
  initialSelectedUser?: UserItem | null;
  initialPermissions?: PermissionItem[];
  permissionDefinitions?: Array<any>;
  templates?: TemplateItem[];
  autoload?: boolean;
  embedded?: boolean;
  canManagePermissions?: boolean;
  canViewInviteCodes?: boolean;
  canManageInviteCodes?: boolean;
  preferredUserId?: string;
}) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(initialSelectedUser);
  const [permissions, setPermissions] = useState<PermissionItem[]>(initialPermissions);
  const [availableTemplates, setAvailableTemplates] = useState<TemplateItem[]>(templates);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(autoload && initialUsers.length === 0));
  const [copySourceUserId, setCopySourceUserId] = useState("");
  const [templateCode, setTemplateCode] = useState(templates[0]?.code || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteCodes, setInviteCodes] = useState<InviteCodeItem[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteMaxUses, setInviteMaxUses] = useState("1");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("");
  const [inviteRemark, setInviteRemark] = useState("");
  const [inviteModules, setInviteModules] = useState<ModuleKey[]>(["dropshipping"]);
  const [latestInviteCode, setLatestInviteCode] = useState("");
  const [copiedInviteNotice, setCopiedInviteNotice] = useState(false);
  const [assignableModules, setAssignableModules] = useState<ModuleKey[]>([]);
  const [selectedModuleKeys, setSelectedModuleKeys] = useState<ModuleKey[]>([]);
  const [selectedModuleSources, setSelectedModuleSources] = useState<{ invite: ModuleKey[]; appended: ModuleKey[] }>({
    invite: [],
    appended: [],
  });
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteForm, setDeleteForm] = useState({
    account: "",
    confirmDelete: "",
  });
  const [inviteListOpen, setInviteListOpen] = useState(false);
  const [inviteListPage, setInviteListPage] = useState(1);

  const text = useMemo(
    () =>
      lang === "zh"
        ? {
            title: "权限管理",
            desc: "统一配置内部用户与客户的页面权限，并管理邀请码",
            internalUsers: "内部用户",
            customers: "客户",
            save: "保存权限",
            reset: "恢复默认权限",
            applyTemplate: "套用权限模板",
            copy: "复制权限",
            moduleEmpty: "暂无权限定义",
            inviteRegistered: "邀请码注册",
            userType: "用户类型",
            role: "角色",
            active: "状态",
            yes: "是",
            no: "否",
            customerTypeDropshipping: "客户",
            customerTypeStaff: "内部用户",
            admin: "管理员",
            worker: "员工",
            enabled: "启用",
            disabled: "停用",
            copyFrom: "复制来源用户",
            selectUser: "请选择用户",
            saved: "权限已保存",
            resetDone: "已恢复默认权限",
            copied: "权限已复制",
            templateDone: "权限模板已套用",
            inviteTitle: "生成邀请码",
            inviteExpiresAt: "失效时间",
            inviteModules: "选择授权功能",
            generateInvite: "生成邀请码",
            inviteList: "已生成邀请码列表",
            inviteStatus: "状态",
            inviteUsage: "使用情况",
            noInvites: "暂无邀请码",
            activeStatus: "可用",
            expiredStatus: "已失效",
            disabledStatus: "已停用",
            inviteUsed: "是否使用",
            inviteRelatedAccount: "关联账号",
            yesUsed: "已使用",
            noUsed: "未使用",
            close: "关闭",
            copiedInvite: "已复制邀请码",
            customerInfo: "用户信息",
            permissionInfo: "权限配置",
            createdAt: "创建时间",
            updatedAt: "更新时间",
            loginAccount: "登录账号",
            customerName: "所属客户",
            dataSource: "数据来源",
            defaultAccessUrl: "默认访问地址",
            customDomain: "自有域名",
            domainStatus: "域名状态",
            sourceInvite: "邀请码注册",
            sourceCustomer: "客户新增",
            sourcePlatform: "平台创建",
            email: "邮箱",
            delete: "删除用户",
            deleteTitle: "删除用户",
            deleteHint: "请完整输入账号和删除文案后再删除。",
            deleteAccount: "账号",
            deleteWord: "请输入“删除”文字",
            deleteAccountPlaceholder: "请输入账号",
            deleteWordPlaceholder: "请输入“删除”文字",
            deleteDone: "用户已删除",
          }
        : {
            title: "Permisos",
            desc: "Configura permisos de personal y clientes, y administra códigos de invitación",
            internalUsers: "Usuarios internos",
            customers: "Clientes",
            save: "Guardar",
            reset: "Restablecer",
            applyTemplate: "Aplicar plantilla",
            copy: "Copiar",
            moduleEmpty: "Sin permisos",
            inviteRegistered: "Registro por invitación",
            userType: "Tipo",
            role: "Rol",
            active: "Estado",
            yes: "Sí",
            no: "No",
            customerTypeDropshipping: "Cliente",
            customerTypeStaff: "Interno",
            admin: "Administrador",
            worker: "Operador",
            enabled: "Activo",
            disabled: "Inactivo",
            copyFrom: "Copiar desde",
            selectUser: "Selecciona un usuario",
            saved: "Permisos guardados",
            resetDone: "Permisos restablecidos",
            copied: "Permisos copiados",
            templateDone: "Plantilla aplicada",
            inviteTitle: "Generar código",
            inviteExpiresAt: "Vence",
            inviteModules: "Selecciona módulos",
            generateInvite: "Generar",
            inviteList: "Códigos generados",
            inviteStatus: "Estado",
            inviteUsage: "Uso",
            noInvites: "Sin códigos",
            activeStatus: "Activo",
            expiredStatus: "Vencido",
            disabledStatus: "Inactivo",
            inviteUsed: "Usado",
            inviteRelatedAccount: "Cuenta",
            yesUsed: "Sí",
            noUsed: "No",
            close: "Cerrar",
            copiedInvite: "Código copiado",
            customerInfo: "Usuario",
            permissionInfo: "Permisos",
            createdAt: "Creado",
            updatedAt: "Actualizado",
            loginAccount: "Cuenta",
            customerName: "Cliente",
            dataSource: "Origen",
            defaultAccessUrl: "Acceso predeterminado",
            customDomain: "Dominio propio",
            domainStatus: "Estado del dominio",
            sourceInvite: "Invitación",
            sourceCustomer: "Cliente",
            sourcePlatform: "Plataforma",
            email: "Correo",
            delete: "Eliminar",
            deleteTitle: "Eliminar usuario",
            deleteHint: "Captura la cuenta y el texto para eliminar.",
            deleteAccount: "Cuenta",
            deleteWord: "Escribe “删除”",
            deleteAccountPlaceholder: "Escribe la cuenta",
            deleteWordPlaceholder: "Escribe 删除",
            deleteDone: "Usuario eliminado",
          },
    [lang],
  );

  const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);
  const groupedUsers = useMemo(() => groupUsers(users), [users]);
  const pagedInviteCodes = useMemo(() => {
    const pageSize = 3;
    const totalPages = Math.max(1, Math.ceil(inviteCodes.length / pageSize));
    const currentPage = Math.min(inviteListPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
      items: inviteCodes.slice(start, start + pageSize),
      currentPage,
      totalPages,
    };
  }, [inviteCodes, inviteListPage]);
  const moduleLabelMap: Record<ModuleKey, string> = useMemo(
    () =>
      lang === "zh"
        ? {
            dropshipping: "一件代发",
            pos: "百盛 POS",
            inspection: "验货单",
            billing: "账单",
            dashboard: "仪表盘",
          }
        : {
            dropshipping: "Dropshipping",
            pos: "POS",
            inspection: "Inspección",
            billing: "Facturación",
            dashboard: "Panel",
          },
    [lang],
  );
  const selectedUserIsCustomerScoped = Boolean(
    selectedUser && (selectedUser.userType === "dropshipping_customer" || selectedUser.dropshippingCustomerId),
  );

  async function fetchJson(url: string, init?: RequestInit) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch(url, { cache: "no-store", ...init });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "request_failed");
        }
        return data;
      } catch (caughtError) {
        lastError = caughtError;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("request_failed");
  }

  async function loadPermissionsData(userId?: string) {
    const targetUserId = userId || preferredUserId;
    const url = targetUserId
      ? `/api/admin/customer-permissions?userId=${encodeURIComponent(targetUserId)}`
      : "/api/admin/customer-permissions";
    const data = await fetchJson(url);
    setUsers(data.users || []);
    setSelectedUser(data.selectedUser || null);
    setPermissions(data.permissions || []);
    setAvailableTemplates(data.templates || templates);
    setTemplateCode(data.defaultTemplateCode || data.templates?.[0]?.code || templates[0]?.code || "");
    setAssignableModules((data.assignableModules || []) as ModuleKey[]);
    setSelectedModuleKeys((data.selectedModuleKeys || []) as ModuleKey[]);
    setSelectedModuleSources({
      invite: (data.selectedModuleSources?.invite || []) as ModuleKey[],
      appended: (data.selectedModuleSources?.appended || []) as ModuleKey[],
    });
    setError("");
  }

  async function loadInviteCodes() {
    if (!canViewInviteCodes) return;
    setInviteLoading(true);
    try {
      const data = await fetchJson("/api/admin/invite-codes");
      setInviteCodes(data.items || []);
      setInviteListPage(1);
      setAssignableModules((data.assignableModules || []) as ModuleKey[]);
      setInviteModules((current) => current.filter((item) => (data.assignableModules || []).includes(item)).length ? current.filter((item) => (data.assignableModules || []).includes(item)) as ModuleKey[] : ((data.assignableModules || []).slice(0, 1) as ModuleKey[]));
      setError("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "load_invites_failed");
    } finally {
      setInviteLoading(false);
    }
  }

  useEffect(() => {
    if (!autoload) return;
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        await loadPermissionsData();
        await loadInviteCodes();
      } catch (caughtError) {
        if (!canceled) {
          setError(caughtError instanceof Error ? caughtError.message : "load_failed");
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [autoload]);

  useEffect(() => {
    if (!autoload && canViewInviteCodes) {
      void loadInviteCodes();
    }
  }, [autoload, canViewInviteCodes]);

  async function selectUser(userId: string) {
    try {
      setError("");
      setMessage("");
      await loadPermissionsData(userId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "load_failed");
    }
  }

  function togglePermission(key: string, checked: boolean) {
    setPermissions((prev) => prev.map((item) => (item.key === key ? { ...item, allowed: checked } : item)));
  }

  function toggleInviteModule(moduleKey: ModuleKey, checked: boolean) {
    setInviteModules((prev) => {
      if (checked) return prev.includes(moduleKey) ? prev : [...prev, moduleKey];
      const next = prev.filter((item) => item !== moduleKey);
      return next.length ? next : prev;
    });
  }

  function toggleSelectedModule(moduleKey: ModuleKey, checked: boolean) {
    setSelectedModuleKeys((prev) => {
      if (checked) return prev.includes(moduleKey) ? prev : [...prev, moduleKey];
      return prev.filter((item) => item !== moduleKey);
    });
  }

  async function savePermissions() {
    if (!selectedUser || !canManagePermissions) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const grants = Object.fromEntries(permissions.map((item) => [item.key, item.allowed]));
      const res = await fetch("/api/admin/customer-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          grants,
          moduleKeys: selectedUserIsCustomerScoped ? selectedModuleKeys : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "save_failed");
      setPermissions(data.permissions || []);
      setSelectedModuleKeys((data.selectedModuleKeys || []) as ModuleKey[]);
      setMessage(text.saved);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function resetPermissions() {
    if (!selectedUser || !canManagePermissions) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/customer-permissions/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "reset_failed");
      setPermissions(data.permissions || []);
      setMessage(text.resetDone);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "reset_failed");
    } finally {
      setSaving(false);
    }
  }

  async function applyTemplate() {
    if (!selectedUser || !templateCode || !canManagePermissions) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/customer-permissions/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, templateCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "template_failed");
      setPermissions(data.permissions || []);
      setMessage(text.templateDone);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "template_failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyPermissions() {
    if (!selectedUser || !copySourceUserId || !canManagePermissions) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/customer-permissions/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUserId: copySourceUserId,
          targetUserId: selectedUser.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "copy_failed");
      setPermissions(data.permissions || []);
      setMessage(text.copied);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "copy_failed");
    } finally {
      setSaving(false);
    }
  }

  async function generateInviteCode() {
    if (!canManageInviteCodes) return;
    setInviteSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUses: Number(inviteMaxUses || 1),
          expiresAt: inviteExpiresAt || null,
          remark: inviteRemark,
          moduleKeys: inviteModules,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "invite_create_failed");
      setInviteExpiresAt("");
      setLatestInviteCode(data.item.code || "");
      await loadInviteCodes();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "invite_create_failed");
    } finally {
      setInviteSaving(false);
    }
  }

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedInviteNotice(true);
      setTimeout(() => setCopiedInviteNotice(false), 1600);
    } catch {
      setError(lang === "zh" ? "复制邀请码失败" : "No se pudo copiar");
    }
  }

  function openDeleteModal() {
    if (!selectedUser) return;
    setDeleteTarget(selectedUser);
    setDeleteForm({
      account: "",
      confirmDelete: "",
    });
    setError("");
    setMessage("");
  }

  function closeDeleteModal() {
    setDeleteTarget(null);
    setDeleteForm({
      account: "",
      confirmDelete: "",
    });
  }

  async function deleteSelectedUser() {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deleteTarget.id,
          confirmAccount: deleteForm.account.trim(),
          confirmDelete: deleteForm.confirmDelete.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "delete_failed");
      }
      setUsers((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setSelectedUser(null);
      setPermissions([]);
      setSelectedModuleKeys([]);
      setSelectedModuleSources({ invite: [], appended: [] });
      setMessage(text.deleteDone);
      closeDeleteModal();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "delete_failed");
    } finally {
      setSaving(false);
    }
  }

  const userGroups = [
    { key: "internal", label: text.internalUsers, items: groupedUsers.internal },
    { key: "customer", label: text.customers, items: groupedUsers.customers },
  ];

  return (
    <section className={`space-y-4 ${embedded ? "" : "p-0"}`}>
      <div className={`${embedded ? "rounded-xl border border-slate-200 bg-white p-5" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{text.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{text.desc}</p>
          </div>
          {canManagePermissions ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={resetPermissions}
                disabled={!selectedUser || saving}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {text.reset}
              </button>
              <button
                type="button"
                onClick={savePermissions}
                disabled={!selectedUser || saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {text.save}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Loading...</div>
      ) : null}

      {!loading ? (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={`${embedded ? "rounded-xl border border-slate-200 bg-white p-4" : "rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"}`}>
            <div className="space-y-4">
              {userGroups.map((group) => (
                <div key={group.key}>
                  <div className="mb-2 text-sm font-semibold text-slate-900">{group.label}</div>
                  <div className="space-y-2">
                    {group.items.map((user) => {
                      const active = selectedUser?.id === user.id;
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => void selectUser(user.id)}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                            active ? "border-primary bg-secondary-accent/70" : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <UserAvatar user={user} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-sm font-semibold text-slate-900">{user.name}</div>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                {user.active ? text.enabled : text.disabled}
                              </span>
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500">{user.phone}</div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {user.role === "admin" ? text.admin : user.userType === "dropshipping_customer" ? text.customerTypeDropshipping : text.worker}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="space-y-4">
            <section className={`${embedded ? "rounded-xl border border-slate-200 bg-white p-5" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"}`}>
              {selectedUser ? (
                <>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                    <div className="flex items-start gap-4 rounded-xl bg-white py-1">
                      <UserAvatar user={selectedUser} />
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-semibold text-slate-900">{selectedUser.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {text.loginAccount}：{selectedUser.userId || "-"}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">{selectedUser.phone}</div>
                        <div className="mt-1 text-sm text-slate-500">{selectedUser.email || "-"}</div>
                        {selectedUser.customerName ? (
                          <div className="mt-1 text-sm text-slate-500">
                            {text.customerName}：{selectedUser.customerName}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-1">
                      <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">{text.userType}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {selectedUser.userType === "dropshipping_customer" ? text.customerTypeDropshipping : text.customerTypeStaff}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">{text.role}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {selectedUser.role === "admin" ? text.admin : text.worker}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">{text.inviteRegistered}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {selectedUser.inviteRegistered ? text.yes : text.no}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">{text.active}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {selectedUser.active ? text.enabled : text.disabled}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">{text.createdAt}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{fmtTime(selectedUser.createdAt)}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">{text.updatedAt}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {selectedUser.updatedAt ? fmtTime(selectedUser.updatedAt) : "-"}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">{text.dataSource}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {getDataSourceLabel(selectedUser.dataSource, text)}
                          </div>
                        </div>
                        {selectedUser.dropshippingCustomerId ? (
                          <>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="text-xs text-slate-500">{text.defaultAccessUrl}</div>
                              <div className="mt-1 break-all text-sm font-semibold text-slate-900">
                                {selectedUser.defaultAccessUrl || "-"}
                              </div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="text-xs text-slate-500">{text.customDomain}</div>
                              <div className="mt-1 break-all text-sm font-semibold text-slate-900">
                                {selectedUser.customDomain || "-"}
                              </div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="text-xs text-slate-500">{text.domainStatus}</div>
                              <div className="mt-1 text-sm font-semibold text-slate-900">
                                {selectedUser.domainStatus || "-"}
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>
                      {canManagePermissions && canDeleteUser(selectedUser) ? (
                        <button
                          type="button"
                          onClick={openDeleteModal}
                          disabled={saving}
                          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {text.delete}
                        </button>
                      ) : null}
                    </div>
                  </div>

                </>
              ) : (
                <div className="text-sm text-slate-500">{text.selectUser}</div>
              )}
            </section>

            {canViewInviteCodes ? (
              <section className={`${embedded ? "rounded-xl border border-slate-200 bg-white p-5" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"}`}>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{text.inviteTitle}</h3>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="block text-sm text-slate-600">
                      <span className="mb-2 block">{text.inviteModules}</span>
                      <div className="flex flex-wrap gap-2">
                        {assignableModules.map((moduleKey) => (
                          <label key={moduleKey} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className="text-sm text-slate-700">{moduleLabelMap[moduleKey]}</span>
                            <input
                              type="checkbox"
                              checked={inviteModules.includes(moduleKey)}
                              onChange={(event) => toggleInviteModule(moduleKey, event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm text-slate-600">
                        <span className="mb-1 block">{text.inviteExpiresAt}</span>
                        <input
                          type="datetime-local"
                          value={inviteExpiresAt}
                          onChange={(event) => setInviteExpiresAt(event.target.value)}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {canManageInviteCodes ? (
                          <button
                            type="button"
                            onClick={generateInviteCode}
                            disabled={inviteSaving}
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
                          >
                            {text.generateInvite}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            void loadInviteCodes();
                            setInviteListPage(1);
                            setInviteListOpen(true);
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                        >
                          {text.inviteList}
                        </button>
                      </div>
                      {latestInviteCode ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-lg font-bold tracking-[0.08em] text-slate-950">{latestInviteCode}</div>
                            <button
                              type="button"
                              onClick={() => void copyInviteCode(latestInviteCode)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                              aria-label="复制邀请码"
                              title="复制邀请码"
                            >
                              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                                <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h7A1.5 1.5 0 0 1 17 3.5v8A1.5 1.5 0 0 1 15.5 13h-7A1.5 1.5 0 0 1 7 11.5v-8Z" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M4.5 7A1.5 1.5 0 0 0 3 8.5v7A1.5 1.5 0 0 0 4.5 17h7A1.5 1.5 0 0 0 13 15.5" stroke="currentColor" strokeWidth="1.5"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {inviteListOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
                <div className="w-full max-w-5xl rounded-2xl bg-white shadow-soft">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
                    <h2 className="text-[18px] font-bold tracking-tight text-slate-900">{text.inviteList}</h2>
                    <button
                      type="button"
                      onClick={() => {
                        void loadInviteCodes();
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    >
                      刷新
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-auto p-6">
                    {inviteLoading ? (
                      <div className="rounded-xl border border-slate-200 px-4 py-10 text-center text-sm text-slate-500">加载中...</div>
                    ) : inviteCodes.length ? (
                      <div className="space-y-3">
                        {pagedInviteCodes.items.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-lg font-semibold tracking-[0.08em] text-slate-900">{item.code}</div>
                                {item.moduleKeys?.length ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.moduleKeys.map((moduleKey) => (
                                      <span key={`${item.id}-${moduleKey}`} className="rounded-full bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                                        {moduleLabelMap[moduleKey as ModuleKey] || moduleKey}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                item.status === "active"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : item.status === "expired"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                              }`}>
                                {item.status === "active" ? text.activeStatus : item.status === "expired" ? text.expiredStatus : text.disabledStatus}
                              </span>
                            </div>
                            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                              <div>
                                <div className="text-xs text-slate-500">{text.inviteUsed}</div>
                                <div className="mt-1 font-medium text-slate-900">{item.used ? text.yesUsed : text.noUsed}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">{text.inviteRelatedAccount}</div>
                                <div className="mt-1 font-medium text-slate-900">
                                  {item.relatedAccounts?.length
                                    ? item.relatedAccounts.map((account) => account.account).join("，")
                                    : "-"}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">{text.inviteExpiresAt}</div>
                                <div className="mt-1 font-medium text-slate-900">{fmtTime(item.expiresAt)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">{text.createdAt}</div>
                                <div className="mt-1 font-medium text-slate-900">{fmtTime(item.createdAt)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                        {text.noInvites}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <button
                        type="button"
                        onClick={() => setInviteListPage((prev) => Math.max(1, prev - 1))}
                        disabled={pagedInviteCodes.currentPage <= 1}
                        className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-40"
                      >
                        {"<"}
                      </button>
                      <span>{pagedInviteCodes.currentPage} / {pagedInviteCodes.totalPages}</span>
                      <button
                        type="button"
                        onClick={() => setInviteListPage((prev) => Math.min(pagedInviteCodes.totalPages, prev + 1))}
                        disabled={pagedInviteCodes.currentPage >= pagedInviteCodes.totalPages}
                        className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-40"
                      >
                        {">"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInviteListOpen(false)}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {text.close}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {copiedInviteNotice ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/15 p-4">
                <div className="rounded-2xl bg-white px-6 py-5 shadow-soft">
                  <div className="text-base font-semibold text-slate-900">{text.copiedInvite}</div>
                </div>
              </div>
            ) : null}

            {canManagePermissions && selectedUserIsCustomerScoped ? (
              <section className={`${embedded ? "rounded-xl border border-slate-200 bg-white p-5" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"}`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{text.permissionInfo}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {lang === "zh" ? "客户当前模块与来源" : "Modulos actuales y origen"}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {assignableModules.map((moduleKey) => {
                    const checked = selectedModuleKeys.includes(moduleKey);
                    const source = selectedModuleSources.invite.includes(moduleKey)
                      ? (lang === "zh" ? "邀请码初始授权" : "Invitación")
                      : selectedModuleSources.appended.includes(moduleKey)
                        ? (lang === "zh" ? "后台追加授权" : "Adicional")
                        : (lang === "zh" ? "未开通" : "Sin acceso");
                    return (
                      <label key={moduleKey} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{moduleLabelMap[moduleKey]}</div>
                          <div className="mt-1 text-xs text-slate-500">{source}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleSelectedModule(moduleKey, event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {deleteTarget ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
                <div className="w-full max-w-lg rounded-xl bg-white shadow-soft">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h2 className="text-[18px] font-bold tracking-tight text-slate-900">
                      {text.deleteTitle}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">{text.deleteHint}</p>
                  </div>
                  <div className="space-y-4 p-6">
                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">{deleteTarget.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        用户账号：{deleteTarget.userId || deleteTarget.phone}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {text.deleteAccount}
                      </label>
                      <input
                        value={deleteForm.account}
                        onChange={(event) => setDeleteForm((prev) => ({ ...prev, account: event.target.value }))}
                        placeholder={text.deleteAccountPlaceholder}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {text.deleteWord}
                      </label>
                      <input
                        value={deleteForm.confirmDelete}
                        onChange={(event) => setDeleteForm((prev) => ({ ...prev, confirmDelete: event.target.value }))}
                        placeholder={text.deleteWordPlaceholder}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
                    <button
                      type="button"
                      onClick={closeDeleteModal}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {lang === "zh" ? "取消" : "Cancelar"}
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedUser}
                      disabled={saving}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                    >
                      {text.delete}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {canManagePermissions && !selectedUserIsCustomerScoped ? (
              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {groupedPermissions.length === 0 ? (
                  <div className={`${embedded ? "rounded-xl border border-slate-200 bg-white p-5" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"} text-sm text-slate-500 xl:col-span-2 2xl:col-span-3`}>
                    {text.moduleEmpty}
                  </div>
                ) : null}
                {groupedPermissions.map((group) => (
                  <section key={group.module} className={getPermissionSectionClass(group.rows.length, embedded)}>
                    <div className="mb-4 text-base font-semibold text-slate-900">{getPermissionGroupTitle(group.module)}</div>
                    <div className={getPermissionGridClass(group.rows.length)}>
                      {group.rows.map((item) => (
                        <label
                          key={item.key}
                          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.description || item.key}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={item.allowed}
                            onChange={(event) => togglePermission(item.key, event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
