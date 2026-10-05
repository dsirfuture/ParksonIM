"use client";

import Image from "next/image";
import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PHONE_COUNTRIES, type PhoneCountryCode } from "@/lib/user-account";

type Lang = "zh" | "es";
type MemberRow = {
  id: string;
  name: string;
  nameZh: string;
  nameEn: string;
  userId: string;
  phone: string;
  phoneCountry: string;
  email: string;
  avatarUrl?: string | null;
  remark: string;
  dataSource: string;
  active: boolean;
  userType: string;
  customerOrgRole: "owner" | "manager" | "staff";
  createdAt: string;
  updatedAt: string;
  permissionGroupKeys: string[];
  canManageSettings: boolean;
};

type MemberForm = {
  id: string;
  name: string;
  nameZh: string;
  nameEn: string;
  userId: string;
  phone: string;
  phoneCountry: string;
  email: string;
  remark: string;
  password: string;
  customerOrgRole: "owner" | "manager" | "staff";
  permissionGroupKeys: string[];
  canManageSettings: boolean;
  active: boolean;
};

const EMPTY_FORM: MemberForm = {
  id: "",
  name: "",
  nameZh: "",
  nameEn: "",
  userId: "",
  phone: "",
  phoneCountry: "MX",
  email: "",
  remark: "",
  password: "",
  customerOrgRole: "staff",
  permissionGroupKeys: [],
  canManageSettings: false,
  active: true,
};

export function CustomerTeamManager({
  lang,
  canManage = true,
}: {
  lang: Lang;
  canManage?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [availableGroups, setAvailableGroups] = useState<
    Array<{ key: string; title: string; items: string[] }>
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "domain">("users");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [createdCredentials, setCreatedCredentials] = useState<{
    loginName: string;
    password: string;
  } | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteConfirmAccount, setDeleteConfirmAccount] = useState("");
  const [deleteConfirmWord, setDeleteConfirmWord] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [domainLoading, setDomainLoading] = useState(true);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainChecking, setDomainChecking] = useState(false);
  const [domainState, setDomainState] = useState({
    customerName: "",
    customDomain: "",
    customDomainEnabled: false,
    defaultSlug: "",
    defaultAccessUrl: "",
    domainSource: "system_default",
    domainStatus: "not_set",
    guide: null as null | { recordType: string; host: string; value: string },
  });

  const text = useMemo(
    () =>
      lang === "zh"
        ? {
            tabs: ["用户管理", "新增用户", "权限设置"],
            domainTab: "域名设置",
            title: "用户管理",
            desc: "管理当前客户组织范围内的账号、角色、权限和状态。",
            create: "新增用户",
            createSuccess: "新增用户成功",
            edit: "编辑用户",
            close: "关闭",
            save: "保存",
            cancel: "取消",
            copied: "已复制",
            delete: "删除用户",
            deleteTitle: "删除用户",
            deleteHint: "请完整输入账号和删除文案后再删除。",
            deleteAccount: "账号",
            deleteWord: "请输入“删除”文字",
            deleteAccountPlaceholder: "请输入账号",
            deleteWordPlaceholder: "请输入“删除”文字",
            deleteDone: "用户已删除",
            name: "姓名",
            phone: "手机号",
            email: "邮箱",
            nameZh: "中文名",
            nameEn: "英文名",
            userId: "登录账号",
            password: "密码",
            loginName: "登录名",
            loginPassword: "登录密码",
            country: "国家",
            role: "角色类型",
            owner: "主账号",
            manager: "管理人员",
            staff: "员工",
            settingsAccess: "设置权限",
            settingsManage: "允许进入设置",
            active: "启用",
            status: "状态",
            enabled: "启用",
            disabled: "停用",
            createdAt: "创建时间",
            account: "登录账号",
            modules: "授权功能",
            phonePlaceholder: "请输入手机号",
            passwordPlaceholder: "请输入密码",
            noManage: "当前账号只允许查看设置，不能新增或修改用户。",
            created: "用户已创建",
            saved: "用户已保存",
            userType: "用户类型",
            customerUser: "客户用户",
            manageSettingsTag: "可进设置",
            summary: "账号信息",
            permissionSummary: "可用功能",
            domainTitle: "域名设置",
            domainDesc: "填写域名后，按步骤完成解析、检查解析，再启用 HTTPS。",
            customerName: "客户名称",
            customDomain: "自有域名",
            customDomainEnabled: "启用自有域名",
            defaultSlug: "默认路径标识",
            defaultAccessUrl: "默认访问地址",
            domainStatus: "域名状态",
            domainNotSet: "未设置",
            domainPending: "待验证",
            domainEnabled: "已启用",
            domainDisabled: "禁用",
            domainGuide: "解析指引",
            domainStep1: "填写域名",
            domainStep2: "完成解析",
            domainStep3: "检查解析",
            domainStep4: "启用 HTTPS",
            domainHost: "记录名",
            domainValue: "记录值",
            domainType: "记录类型",
            domainCheck: "检查解析",
            domainChecking: "检查中",
            openUrl: "打开网址",
            boundUrl: "绑定成功网址",
            domainReady: "已完成",
            domainTodo: "待处理",
            domainInProgress: "处理中",
            empty: "当前没有用户",
            ownerSection: "主账号与成员",
            blockSelected: "已授权",
            ownerAvatarFallback: "主",
            childAvatarFallback: "子",
          }
        : {
            tabs: ["Usuarios", "Nuevo", "Permisos"],
            domainTab: "Dominio",
            title: "Usuarios",
            desc: "Administra cuentas, roles, permisos y estados dentro de tu organización.",
            create: "Nuevo",
            createSuccess: "Usuario creado",
            edit: "Editar",
            close: "Cerrar",
            save: "Guardar",
            cancel: "Cancelar",
            copied: "Copiado",
            delete: "Eliminar usuario",
            deleteTitle: "Eliminar usuario",
            deleteHint: "Completa la cuenta y el texto de eliminación antes de borrar.",
            deleteAccount: "Cuenta",
            deleteWord: "Escribe “删除”",
            deleteAccountPlaceholder: "Ingresa cuenta",
            deleteWordPlaceholder: "Escribe 删除",
            deleteDone: "Usuario eliminado",
            name: "Nombre",
            phone: "Teléfono",
            email: "Correo",
            nameZh: "Nombre ZH",
            nameEn: "Nombre EN",
            userId: "Usuario",
            password: "Clave",
            loginName: "Usuario",
            loginPassword: "Clave",
            country: "Pais",
            role: "Tipo",
            owner: "Titular",
            manager: "Manager",
            staff: "Staff",
            settingsAccess: "Ajustes",
            settingsManage: "Puede entrar a ajustes",
            active: "Activo",
            status: "Estado",
            enabled: "Activo",
            disabled: "Inactivo",
            createdAt: "Creado",
            account: "Cuenta",
            modules: "Funciones",
            phonePlaceholder: "Ingresa teléfono",
            passwordPlaceholder: "Ingresa contraseña",
            noManage: "Esta cuenta solo puede ver usuarios y no puede modificarlos.",
            created: "Usuario creado",
            saved: "Usuario guardado",
            userType: "Tipo",
            customerUser: "Cliente",
            manageSettingsTag: "Ajustes",
            summary: "Cuenta",
            permissionSummary: "Funciones",
            domainTitle: "Dominio",
            domainDesc: "Guarda el dominio y sigue los pasos para DNS, verificacion y HTTPS.",
            customerName: "Cliente",
            customDomain: "Dominio propio",
            customDomainEnabled: "Usar dominio propio",
            defaultSlug: "Slug",
            defaultAccessUrl: "Acceso predeterminado",
            domainStatus: "Estado del dominio",
            domainNotSet: "Sin configurar",
            domainPending: "Pendiente",
            domainEnabled: "Activo",
            domainDisabled: "Inactivo",
            domainGuide: "Guia DNS",
            domainStep1: "Dominio",
            domainStep2: "DNS",
            domainStep3: "Verificar",
            domainStep4: "HTTPS",
            domainHost: "Host",
            domainValue: "Valor",
            domainType: "Tipo",
            domainCheck: "Verificar",
            domainChecking: "Verificando",
            openUrl: "Abrir",
            boundUrl: "URL activa",
            domainReady: "Listo",
            domainTodo: "Pendiente",
            domainInProgress: "En curso",
            empty: "Sin usuarios",
            ownerSection: "Titular y equipo",
            blockSelected: "Autorizado",
            ownerAvatarFallback: "T",
            childAvatarFallback: "S",
          },
    [lang],
  );

  const selectedMember = useMemo(
    () => members.find((item) => item.id === selectedId) || members[0] || null,
    [members, selectedId],
  );

  const groupedAvailableFeatures = useMemo(() => {
    const order = [
      "总览",
      "订单管理",
      "备货和发货",
      "财务结算",
      "代发快捷设置",
      "仪表盘",
      "验货单",
      "账单",
      "百盛POS",
    ];
    const groupMap = new Map<string, { title: string; keys: string[]; items: string[] }>();

    for (const group of availableGroups) {
      let parentTitle = group.title;
      if (group.key.startsWith("dropshipping.orders.")) parentTitle = "订单管理";
      else if (group.key.startsWith("dropshipping.inventory.")) parentTitle = "备货和发货";
      else if (group.key.startsWith("dropshipping.finance.") || group.key.startsWith("dropshipping.supplier_misc.")) {
        parentTitle = "财务结算";
      } else if (group.key.startsWith("dropshipping.quick_setup.")) {
        parentTitle = "代发快捷设置";
      }

      const existing = groupMap.get(parentTitle) || { title: parentTitle, keys: [], items: [] };
      existing.keys.push(group.key);
      for (const item of group.items) {
        if (!existing.items.includes(item)) {
          existing.items.push(item);
        }
      }
      groupMap.set(parentTitle, existing);
    }

    return Array.from(groupMap.values()).sort((left, right) => {
      const leftIndex = order.indexOf(left.title);
      const rightIndex = order.indexOf(right.title);
      const safeLeft = leftIndex === -1 ? 999 : leftIndex;
      const safeRight = rightIndex === -1 ? 999 : rightIndex;
      return safeLeft - safeRight;
    });
  }, [availableGroups]);

  async function loadData() {
    const res = await fetch("/api/account/team", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "load_failed");
    }
    const nextMembers = (data.members || []) as MemberRow[];
    setMembers(nextMembers);
    setAvailableGroups(data.availableGroups || []);
    setSelectedId((current) =>
      nextMembers.some((item) => item.id === current) ? current : nextMembers[0]?.id || null,
    );
  }

  async function loadDomain() {
    const res = await fetch("/api/account/domain-settings", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "domain_load_failed");
    }
    setDomainState({
      customerName: data.domain?.customerName || "",
      customDomain: data.domain?.customDomain || "",
      customDomainEnabled: Boolean(data.domain?.customDomainEnabled),
      defaultSlug: data.domain?.defaultSlug || "",
      defaultAccessUrl: data.domain?.defaultAccessUrl || "",
      domainSource: data.domain?.domainSource || "system_default",
      domainStatus: data.domain?.domainStatus || "not_set",
      guide: data.domain?.guide || null,
    });
  }

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setDomainLoading(true);
        await Promise.all([loadData(), loadDomain()]);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "load_failed");
      } finally {
        setLoading(false);
        setDomainLoading(false);
      }
    })();
  }, []);

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      permissionGroupKeys: [],
    });
  }

  function closeCreatedCredentials() {
    setCreatedCredentials(null);
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false);
    setDeleteConfirmAccount("");
    setDeleteConfirmWord("");
  }

  function openCreateModal() {
    setMessage("");
    setError("");
    setEditingId("new");
    setForm({
      ...EMPTY_FORM,
      userId: "",
      permissionGroupKeys: [],
    });
    setModalOpen(true);
  }

  function openEditModal(member: MemberRow) {
    setMessage("");
    setError("");
    setEditingId(member.id);
    setForm({
      id: member.id,
      name: member.name,
      nameZh: member.nameZh || "",
      nameEn: member.nameEn || "",
      userId: member.userId || "",
      phone: member.phone,
      phoneCountry: member.phoneCountry || "MX",
      email: member.email || "",
      remark: member.remark || "",
      password: "",
      customerOrgRole:
        member.customerOrgRole === "owner"
          ? "owner"
          : member.customerOrgRole === "manager"
            ? "manager"
            : "staff",
      permissionGroupKeys: member.permissionGroupKeys || [],
      canManageSettings: Boolean(
        member.customerOrgRole === "manager" && member.canManageSettings,
      ),
      active: member.active,
    });
    setModalOpen(true);
  }

  function togglePermissionGroup(groupKey: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      permissionGroupKeys: checked
        ? prev.permissionGroupKeys.includes(groupKey)
          ? prev.permissionGroupKeys
          : [...prev.permissionGroupKeys, groupKey]
        : prev.permissionGroupKeys.filter((item) => item !== groupKey),
    }));
  }

  async function saveMember() {
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const isCreate = editingId === "new";
      const effectiveLoginName = form.name.trim();
      const payload = {
        ...form,
        userId: effectiveLoginName,
        ...(form.customerOrgRole === "owner"
          ? {
              companyDisplayName: domainState.customerName || form.name,
              companyNameZh: "",
              companyNameEn: "",
            }
          : {}),
      };
      const res = await fetch("/api/account/team", {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "save_failed");
      }
      await loadData();
      closeModal();
      if (isCreate) {
        setCreatedCredentials({
          loginName: data.member?.userId || effectiveLoginName || form.phone,
          password: form.password,
        });
      }
      if (!isCreate) {
        if (form.customerOrgRole === "owner") {
          await loadDomain();
        }
        setMessage(text.saved);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyCreatedCredentials() {
    if (!createdCredentials) return;
    const value = `${text.loginName}：${createdCredentials.loginName}\n${text.loginPassword}：${createdCredentials.password}`;
    await navigator.clipboard.writeText(value);
  }

  async function deleteMember() {
    if (!selectedMember) return;
    try {
      setDeleteSaving(true);
      setError("");
      setMessage("");
      const res = await fetch("/api/account/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedMember.id,
          confirmAccount: deleteConfirmAccount,
          confirmDelete: deleteConfirmWord,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "delete_failed");
      }
      closeDeleteModal();
      await loadData();
      setMessage(text.deleteDone);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "delete_failed");
    } finally {
      setDeleteSaving(false);
    }
  }

  async function saveDomainSettings() {
    try {
      setDomainSaving(true);
      setError("");
      setMessage("");
      const res = await fetch("/api/account/domain-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(domainState),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "domain_save_failed");
      }
      setDomainState({
        customerName: data.domain?.customerName || "",
        customDomain: data.domain?.customDomain || "",
        customDomainEnabled: Boolean(data.domain?.customDomainEnabled),
        defaultSlug: data.domain?.defaultSlug || "",
        defaultAccessUrl: data.domain?.defaultAccessUrl || "",
        domainSource: data.domain?.domainSource || "system_default",
        domainStatus: data.domain?.domainStatus || "not_set",
        guide: data.domain?.guide || null,
      });
      setMessage(data.message || text.saved);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "domain_save_failed");
    } finally {
      setDomainSaving(false);
    }
  }

  async function checkDomainSettings() {
    try {
      setDomainChecking(true);
      setError("");
      setMessage("");
      const res = await fetch("/api/account/domain-settings", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "domain_check_failed");
      }
      setDomainState({
        customerName: data.domain?.customerName || "",
        customDomain: data.domain?.customDomain || "",
        customDomainEnabled: Boolean(data.domain?.customDomainEnabled),
        defaultSlug: data.domain?.defaultSlug || "",
        defaultAccessUrl: data.domain?.defaultAccessUrl || "",
        domainSource: data.domain?.domainSource || "system_default",
        domainStatus: data.domain?.domainStatus || "not_set",
        guide: data.domain?.guide || null,
      });
      setMessage(data.message || text.saved);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "domain_check_failed");
    } finally {
      setDomainChecking(false);
    }
  }

  function getDomainStatusLabel(status: string) {
    if (status === "pending_verification") return text.domainPending;
    if (status === "disabled") return text.domainDisabled;
    if (status === "active") return text.domainEnabled;
    return text.domainNotSet;
  }

  function getDomainProgress() {
    if (!domainState.customDomain) {
      return [text.domainTodo, text.domainTodo, text.domainTodo, text.domainTodo];
    }
    if (!domainState.customDomainEnabled) {
      return [text.domainReady, text.domainTodo, text.domainTodo, text.domainTodo];
    }
    if (domainState.domainStatus === "active") {
      return [text.domainReady, text.domainReady, text.domainReady, text.domainReady];
    }
    return [text.domainReady, text.domainReady, text.domainInProgress, text.domainTodo];
  }

  const domainProgress = getDomainProgress();
  const progressTone = (value: string) => {
    if (value === text.domainReady) return "done";
    if (value === text.domainInProgress) return "working";
    return "todo";
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="space-y-5 px-6 py-5">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {!canManage ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {text.noManage}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
              activeTab === "users"
                ? "bg-primary text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {text.title}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("domain")}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
              activeTab === "domain"
                ? "bg-primary text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {text.domainTab}
          </button>
        </div>

        {activeTab === "users" ? (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">{text.ownerSection}</h3>
              {canManage ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-xs font-semibold text-slate-700"
                >
                  {text.create}
                </button>
              ) : null}
            </div>
            <div className="space-y-3 p-4">
              {loading ? (
                <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  Loading...
                </div>
              ) : members.length === 0 ? (
                <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  {text.empty}
                </div>
              ) : (
                members.map((member) => {
                  const active = selectedMember?.id === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedId(member.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        active
                          ? "border-primary bg-rose-50/70"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                            {member.avatarUrl ? (
                              <Image
                                src={member.avatarUrl}
                                alt={member.name}
                                width={48}
                                height={48}
                                className="h-12 w-12 object-cover"
                              />
                            ) : (
                              <span className="text-lg font-semibold text-primary">
                                {member.customerOrgRole === "owner"
                                  ? text.ownerAvatarFallback
                                  : text.childAvatarFallback}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[16px] font-semibold text-slate-900">
                              {member.name}
                            </div>
                            <div className="mt-1 truncate text-sm text-slate-500">
                              {member.phone}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {member.customerOrgRole === "owner"
                                ? text.owner
                                : member.customerOrgRole === "manager"
                                  ? text.manager
                                  : text.staff}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                            member.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {member.active ? text.enabled : text.disabled}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <div className="space-y-4">
            {selectedMember ? (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
                  <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
                    <div className="min-w-0">
                      <div className="text-[18px] font-semibold text-slate-900">
                        {selectedMember.name}
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        {selectedMember.phone}
                      </div>
                      <div className="mt-1 break-all text-sm text-slate-500">
                        {selectedMember.email || "-"}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      {canManage &&
                      selectedMember.customerOrgRole !== "owner" &&
                      selectedMember.userType !== "dropshipping_customer" ? (
                        <div className="shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setMessage("");
                              setDeleteConfirmAccount("");
                              setDeleteConfirmWord("");
                              setDeleteModalOpen(true);
                            }}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600"
                          >
                            {text.delete}
                          </button>
                        </div>
                      ) : null}
                      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 px-5 py-4">
                          <div className="whitespace-nowrap text-xs text-slate-500">{text.role}</div>
                          <div className="mt-2 whitespace-nowrap text-sm font-semibold text-slate-900">
                            {selectedMember.customerOrgRole === "owner"
                              ? text.owner
                              : selectedMember.customerOrgRole === "manager"
                                ? text.manager
                                : text.staff}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-5 py-4">
                          <div className="whitespace-nowrap text-xs text-slate-500">{text.status}</div>
                          <div className="mt-2 whitespace-nowrap text-sm font-semibold text-slate-900">
                            {selectedMember.active ? text.enabled : text.disabled}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-5 py-4">
                          <div className="whitespace-nowrap text-xs text-slate-500">{text.createdAt}</div>
                          <div className="mt-2 whitespace-nowrap text-sm font-semibold text-slate-900">
                            {new Date(selectedMember.createdAt).toLocaleString(
                              lang === "zh" ? "zh-CN" : "es-MX",
                              {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-900">
                      {text.permissionSummary}
                    </h3>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => openEditModal(selectedMember)}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                      >
                        {text.edit}
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {groupedAvailableFeatures
                      .map((group) => ({
                        ...group,
                        items: group.items.filter((item) =>
                          group.keys.some((groupKey) => selectedMember.permissionGroupKeys.includes(groupKey)),
                        ),
                      }))
                      .filter((group) => group.items.length > 0)
                      .map((group) => (
                      <div
                        key={`${selectedMember.id}-${group.title}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {group.title}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {group.items.map((item) => (
                            <span
                              key={`${group.title}-${item}`}
                              className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </div>
        ) : (
          <section className="mx-auto w-full max-w-[1120px] rounded-2xl border border-slate-200 bg-white px-6 py-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{text.domainTitle}</h3>
              <p className="mt-1 text-sm text-slate-500">{text.domainDesc}</p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid items-center gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <input
                  value={domainState.customerName}
                  onChange={(e) => setDomainState((prev) => ({ ...prev, customerName: e.target.value }))}
                  placeholder={text.customerName}
                  disabled={!canManage}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none disabled:bg-slate-100"
                />
                <div className="flex h-11 items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-4">
                  <div className="shrink-0 text-xs text-slate-500">{text.defaultAccessUrl}</div>
                  <div className="min-w-0 truncate text-sm font-semibold text-slate-900">{domainState.defaultAccessUrl || "-"}</div>
                  {domainState.defaultAccessUrl ? (
                    <a
                      href={domainState.defaultAccessUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
                    >
                      {text.openUrl}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(280px,340px)_140px_repeat(4,minmax(110px,1fr))]">
                <div className="flex h-11 overflow-hidden self-center rounded-xl border border-slate-200 bg-white">
                  <input
                    value={domainState.customDomain}
                    onChange={(e) => setDomainState((prev) => ({ ...prev, customDomain: e.target.value }))}
                    placeholder={text.customDomain}
                    disabled={!canManage}
                    className="h-full w-full bg-transparent px-3.5 text-sm outline-none disabled:bg-slate-100"
                  />
                  <label className="flex h-full items-center border-l border-slate-200 px-3">
                    <input
                      type="checkbox"
                      checked={domainState.customDomainEnabled}
                      onChange={(e) =>
                        setDomainState((prev) => ({ ...prev, customDomainEnabled: e.target.checked }))
                      }
                      disabled={!canManage}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </label>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-xs text-slate-500">{text.domainStatus}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{getDomainStatusLabel(domainState.domainStatus)}</div>
                </div>
                {[text.domainStep1, text.domainStep2, text.domainStep3, text.domainStep4].map((step, index) => {
                  const tone = progressTone(domainProgress[index]);
                  return (
                  <div key={step} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="text-xs text-slate-500">{step}</div>
                    <div
                      className={`mt-2 text-sm font-semibold ${
                        tone === "done"
                          ? "text-slate-400 line-through"
                          : tone === "working"
                            ? "text-amber-600"
                            : "text-rose-500"
                      }`}
                    >
                      {domainProgress[index]}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      {tone === "done"
                        ? lang === "zh"
                          ? "当前步骤已完成"
                          : "Paso completado"
                        : tone === "working"
                          ? lang === "zh"
                            ? "系统正在处理这一步"
                            : "En proceso"
                          : lang === "zh"
                            ? "完成上一步后继续"
                            : "Espera el paso anterior"}
                    </div>
                  </div>
                )})}
              </div>
            </div>

            <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
              {domainState.customDomain ? (
                <div className="max-w-[760px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">{text.domainGuide}</div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <div className="rounded-xl bg-white px-4 py-3">
                      <div className="text-xs text-slate-500">{text.domainType}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{domainState.guide?.recordType || "CNAME"}</div>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-3">
                      <div className="text-xs text-slate-500">{text.domainHost}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{domainState.guide?.host || domainState.customDomain}</div>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-3">
                      <div className="text-xs text-slate-500">{text.domainValue}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{domainState.guide?.value || "im.parksonmx.top"}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div />
              )}

              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={checkDomainSettings}
                    disabled={!canManage || domainChecking || !domainState.customDomain || !domainState.customDomainEnabled}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    {domainChecking ? text.domainChecking : text.domainCheck}
                  </button>
                  <button
                    type="button"
                    onClick={saveDomainSettings}
                    disabled={!canManage || domainSaving}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {text.save}
                  </button>
                </div>
                {domainState.customDomain && domainState.domainStatus === "active" ? (
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-emerald-600">
                      https://{domainState.customDomain}
                    </div>
                    <a
                      href={`https://${domainState.customDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
                    >
                      {text.openUrl}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        )}
      </div>

      {modalOpen ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-[760px] rounded-3xl border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-[20px] font-semibold tracking-tight text-slate-900">
                  {editingId === "new" ? text.create : text.edit}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {text.close}
              </button>
            </div>

            <div className="max-h-[78vh] space-y-4 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={text.name}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none"
                />
                <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white transition">
                  <select
                    value={form.phoneCountry}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        phoneCountry: e.target.value as PhoneCountryCode,
                      }))
                    }
                    className="h-10 min-w-[132px] border-r border-slate-200 bg-transparent px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100"
                  >
                    {PHONE_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {lang === "zh" ? country.labelZh : country.labelEs} {country.dialCode}
                      </option>
                    ))}
                  </select>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        phone: e.target.value.replace(/[^\d\s()-]/g, ""),
                      }))
                    }
                    placeholder={text.phonePlaceholder}
                    className="h-10 w-full bg-transparent px-3.5 text-sm outline-none disabled:bg-slate-100"
                  />
                </div>
                <input
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder={text.email}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none"
                />
                <input
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder={text.passwordPlaceholder}
                  type="password"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none"
                />
                <select
                  value={form.customerOrgRole}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      customerOrgRole: e.target.value as "owner" | "manager" | "staff",
                      canManageSettings:
                        e.target.value === "manager" ? prev.canManageSettings : false,
                    }))
                  }
                  disabled={form.customerOrgRole === "owner"}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none"
                >
                  {form.customerOrgRole === "owner" ? (
                    <option value="owner">{text.owner}</option>
                  ) : null}
                  <option value="staff">{text.staff}</option>
                  <option value="manager">{text.manager}</option>
                </select>
                <label className="flex h-10 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, active: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  {text.active}
                </label>
              </div>

              {form.customerOrgRole === "manager" ? (
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    {text.settingsAccess}
                  </div>
                  <label className="flex h-10 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.canManageSettings}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          canManageSettings: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    {text.settingsManage}
                  </label>
                </div>
              ) : null}

              {form.customerOrgRole !== "owner" ? (
              <div>
                <div className="mb-3 text-sm font-medium text-slate-700">{text.modules}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  {groupedAvailableFeatures.map((group) => (
                    <label
                      key={group.title}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {group.title}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.items
                              .filter((item) => item !== group.title)
                              .map((item) => (
                                <span
                                  key={`${group.title}-${item}`}
                                  className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200"
                                >
                                  {item}
                                </span>
                              ))}
                          </div>
                          {group.keys.some((groupKey) => form.permissionGroupKeys.includes(groupKey)) ? (
                            <div className="mt-2 text-xs text-slate-500">{text.blockSelected}</div>
                          ) : null}
                        </div>
                        <input
                          type="checkbox"
                          checked={group.keys.some((groupKey) => form.permissionGroupKeys.includes(groupKey))}
                          onChange={(e) => {
                            for (const groupKey of group.keys) {
                              togglePermissionGroup(groupKey, e.target.checked);
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={saveMember}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {text.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createdCredentials ? (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-[60] flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-[520px] rounded-3xl border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <h3 className="text-[20px] font-semibold tracking-tight text-slate-900">
                {text.createSuccess}
              </h3>
              <button
                type="button"
                onClick={closeCreatedCredentials}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {text.close}
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-xs text-slate-500">{text.loginName}</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {createdCredentials.loginName}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-xs text-slate-500">{text.loginPassword}</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {createdCredentials.password}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyCreatedCredentials}
                  aria-label={text.copied}
                  className="inline-flex min-h-[88px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-slate-700"
                >
                  <Copy className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={closeCreatedCredentials}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white"
              >
                {text.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteModalOpen && selectedMember ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-[520px] rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-[20px] font-semibold tracking-tight text-slate-900">
                {text.deleteTitle}
              </h3>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="px-1 py-1">
                <div className="text-[18px] font-semibold text-slate-900">{selectedMember.name}</div>
                <div className="mt-2 text-sm text-slate-500">
                  {text.deleteAccount}：{selectedMember.userId || selectedMember.name}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">{text.deleteAccount}</div>
                <input
                  value={deleteConfirmAccount}
                  onChange={(e) => setDeleteConfirmAccount(e.target.value)}
                  placeholder={text.deleteAccountPlaceholder}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none"
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">{text.deleteWord}</div>
                <input
                  value={deleteConfirmWord}
                  onChange={(e) => setDeleteConfirmWord(e.target.value)}
                  placeholder={text.deleteWordPlaceholder}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={deleteMember}
                disabled={deleteSaving}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {text.delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-[55] flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-[420px] rounded-3xl border border-emerald-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="text-sm font-semibold text-emerald-700">{message}</div>
              <button
                type="button"
                onClick={() => setMessage("")}
                className="inline-flex h-9 min-w-[72px] items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              >
                {text.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
