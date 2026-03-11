"use client";

import { useMemo, useRef, useState } from "react";
import { getAvatarFallback } from "@/lib/user-account";

type Lang = "zh" | "es";

type UserProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
  active: boolean;
};

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProfileForm({
  lang,
  initialUser,
}: {
  lang: Lang;
  initialUser: UserProfile;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(initialUser.name || "");
  const [phone, setPhone] = useState(initialUser.phone || "");
  const [email, setEmail] = useState(initialUser.email || "");
  const [avatarUrl, setAvatarUrl] = useState(initialUser.avatar_url || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const text = useMemo(
    () =>
      lang === "zh"
        ? {
            profileCardTitle: "个人资料",
            profileCardDesc: "保持姓名 手机号 邮箱和头像信息准确",
            avatarHint: "点击头像可更新图片",
            avatarSubHint: "建议使用清晰的正方形图片",
            name: "姓名",
            phone: "手机号",
            email: "邮箱",
            password: "新密码",
            passwordPlaceholder: "不修改可留空",
            save: "保存修改",
            saving: "保存中",
            ok: "资料已更新",
          }
        : {
            profileCardTitle: "Perfil",
            profileCardDesc:
              "Mantén actualizado el nombre el teléfono el correo y el avatar",
            avatarHint: "Haz clic en el avatar para actualizar la imagen",
            avatarSubHint: "Se recomienda una imagen cuadrada y clara",
            name: "Nombre",
            phone: "Teléfono",
            email: "Correo",
            password: "Nueva contraseña",
            passwordPlaceholder: "Déjalo vacío si no cambia",
            save: "Guardar cambios",
            saving: "Guardando",
            ok: "Los datos fueron actualizados",
          },
    [lang],
  );

  async function handleAvatarChange(file: File | null) {
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch {
      setError(
        lang === "zh"
          ? "当前未能读取图片 请重新选择"
          : "Por ahora no fue posible leer la imagen",
      );
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      setLoading(true);

      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, avatarUrl, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Save failed");
        return;
      }

      setPassword("");
      setMessage(text.ok);
    } catch {
      setError(
        lang === "zh"
          ? "当前未能保存资料 请稍后再试"
          : "Por ahora no fue posible guardar los datos",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-white shadow-soft">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:gap-4">
          <h2 className="shrink-0 text-[18px] font-semibold tracking-tight text-slate-900">
            {text.profileCardTitle}
          </h2>
          <p className="min-w-0 text-sm leading-6 text-slate-500 lg:pb-[1px]">
            {text.profileCardDesc}
          </p>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative inline-flex h-[116px] w-[116px] items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-secondary-accent text-[40px] font-semibold text-primary transition hover:scale-[1.02] hover:shadow-md"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name || "avatar"}
                className="h-full w-full object-cover"
              />
            ) : (
              getAvatarFallback(name)
            )}

            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-slate-900/35 group-hover:opacity-100">
              {lang === "zh" ? "更换头像" : "Cambiar avatar"}
            </div>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
          />

          <div className="mt-4 text-sm font-medium text-slate-700">
            {text.avatarHint}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {text.avatarSubHint}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {text.name}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={text.name}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {text.phone}
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={text.phone}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {text.email}
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={text.email}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {text.password}
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder={text.passwordPlaceholder}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white"
            />
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-center">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? text.saving : text.save}
          </button>
        </div>
      </div>
    </form>
  );
}
