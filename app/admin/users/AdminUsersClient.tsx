"use client";

import { useMemo, useState } from "react";

type Lang = "zh" | "es";

type UserRow = {
  id: string;
  user_id?: string | null;
  name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  role: "admin" | "worker";
  active: boolean;
  created_at: string;
};

export function AdminUsersClient({
  lang,
  initialUsers,
}: {
  lang: Lang;
  initialUsers: UserRow[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "worker" as "admin" | "worker",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteForm, setDeleteForm] = useState({
    account: "",
    confirmDelete: "",
  });

  const text = useMemo(
    () =>
      lang === "zh"
        ? {
            name: "姓名",
            phone: "手机号",
            email: "邮箱",
            role: "角色",
            status: "状态",
            action: "操作",
            edit: "编辑",
            delete: "删除",
            save: "保存",
            cancel: "取消",
            editTitle: "编辑用户资料",
            roleAdmin: "管理员",
            roleWorker: "员工",
            active: "启用",
            inactive: "停用",
            confirmDelete: "确定删除这个用户吗",
            deleteTitle: "删除用户",
            deleteHint: "请输入账号和删除文案后，才可删除该用户。",
            deleteAccountLabel: "账号",
            deleteConfirmLabel: "删除文案",
            deleteConfirmPlaceholder: "请输入 删除",
            deleteAccountPlaceholder: "请输入账号",
            deleteNeedFullInput: "请完整输入账号和删除文案",
            deleteValidationFailed: "删除校验未通过",
            deleted: "用户已删除",
            updated: "用户资料已更新",
            accountActive: "账号启用",
            passwordPlaceholder: "新密码 不修改可留空",
          }
        : {
            name: "Nombre",
            phone: "Teléfono",
            email: "Correo",
            role: "Rol",
            status: "Estado",
            action: "Acción",
            edit: "Editar",
            delete: "Eliminar",
            save: "Guardar",
            cancel: "Cancelar",
            editTitle: "Editar usuario",
            roleAdmin: "Administrador",
            roleWorker: "Operador",
            active: "Activo",
            inactive: "Inactivo",
            confirmDelete: "¿Confirmas eliminar este usuario?",
            deleteTitle: "Eliminar usuario",
            deleteHint: "Ingresa la cuenta y el texto de eliminación para continuar.",
            deleteAccountLabel: "Cuenta",
            deleteConfirmLabel: "Texto",
            deleteConfirmPlaceholder: "Escribe 删除",
            deleteAccountPlaceholder: "Escribe la cuenta",
            deleteNeedFullInput: "Completa la cuenta y el texto",
            deleteValidationFailed: "La validación para eliminar no pasó",
            deleted: "El usuario fue eliminado",
            updated: "Los datos del usuario fueron actualizados",
            accountActive: "Cuenta activa",
            passwordPlaceholder: "Nueva contraseña Déjalo vacío si no cambia",
          },
    [lang],
  );

  function beginEdit(user: UserRow) {
    setError("");
    setMessage("");
    setEditingId(user.id);
    setForm({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email || "",
      password: "",
      role: user.role,
      active: user.active,
    });
  }

  function closeEdit() {
    setEditingId(null);
    setForm({
      id: "",
      name: "",
      phone: "",
      email: "",
      password: "",
      role: "worker",
      active: true,
    });
  }

  async function saveEdit() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Save failed");
        return;
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id === data.user.id
            ? {
                ...item,
                ...data.user,
              }
            : item,
        ),
      );

      closeEdit();
      setMessage(text.updated);
    } finally {
      setSaving(false);
    }
  }

  function beginDelete(user: UserRow) {
    setError("");
    setMessage("");
    setDeleteTarget(user);
    setDeleteForm({
      account: "",
      confirmDelete: "",
    });
  }

  function closeDelete() {
    setDeleteTarget(null);
    setDeleteForm({
      account: "",
      confirmDelete: "",
    });
  }

  async function deleteUser() {
    if (!deleteTarget) return;
    setError("");
    setMessage("");
    if (!deleteForm.account.trim() || !deleteForm.confirmDelete.trim()) {
      setError(text.deleteNeedFullInput);
      return;
    }

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
      setError(data.error || "Delete failed");
      return;
    }

    setUsers((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    if (editingId === deleteTarget.id) {
      closeEdit();
    }
    closeDelete();
    setMessage(text.deleted);
  }

  return (
    <>
      <div className="grid gap-0">
        {message ? (
          <div className="mx-6 mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mx-6 mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left text-sm text-slate-500">
                <th className="px-4 py-3 font-semibold">头像</th>
                <th className="px-4 py-3 font-semibold">{text.name}</th>
                <th className="px-4 py-3 font-semibold">{text.phone}</th>
                <th className="px-4 py-3 font-semibold">{text.email}</th>
                <th className="px-4 py-3 font-semibold">{text.role}</th>
                <th className="px-4 py-3 font-semibold">{text.status}</th>
                <th className="px-4 py-3 text-right font-semibold">
                  {text.action}
                </th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-slate-100 transition hover:bg-rose-50/60"
                >
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name || "avatar"}
                        className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
                        {String(user.name || user.phone || "U").trim().slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {user.name}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {user.phone}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {user.email || "-"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {user.role === "admin" ? text.roleAdmin : text.roleWorker}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {user.active ? text.active : text.inactive}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(user)}
                        className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {text.edit}
                      </button>

                      {user.role !== "admin" ? (
                        <button
                          type="button"
                          onClick={() => beginDelete(user)}
                          className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          {text.delete}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-soft">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-[18px] font-bold tracking-tight text-slate-900">
                {text.editTitle}
              </h2>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder={text.name}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
              />

              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder={text.phone}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
              />

              <input
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder={text.email}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
              />

              <input
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                type="password"
                placeholder={text.passwordPlaceholder}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
              />

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="user-role"
                      checked={form.role === "admin"}
                      onChange={() => setForm((p) => ({ ...p, role: "admin" }))}
                    />
                    <span>{text.roleAdmin}</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="user-role"
                      checked={form.role === "worker"}
                      onChange={() =>
                        setForm((p) => ({ ...p, role: "worker" }))
                      }
                    />
                    <span>{text.roleWorker}</span>
                  </label>
                </div>
              </div>

              <label className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, active: e.target.checked }))
                  }
                  className="mr-2"
                />
                {text.accountActive}
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {text.cancel}
              </button>

              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
              >
                {saving
                  ? lang === "zh"
                    ? "保存中..."
                    : "Guardando..."
                  : text.save}
              </button>
            </div>
          </div>
        </div>
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
                  {text.deleteAccountLabel}：{deleteTarget.user_id || deleteTarget.phone}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {text.deleteAccountLabel}
                </label>
                <input
                  value={deleteForm.account}
                  onChange={(e) => setDeleteForm((prev) => ({ ...prev, account: e.target.value }))}
                  placeholder={text.deleteAccountPlaceholder}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {text.deleteConfirmLabel}
                </label>
                <input
                  value={deleteForm.confirmDelete}
                  onChange={(e) => setDeleteForm((prev) => ({ ...prev, confirmDelete: e.target.value }))}
                  placeholder={text.deleteConfirmPlaceholder}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDelete}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={deleteUser}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:opacity-95"
              >
                {text.delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
