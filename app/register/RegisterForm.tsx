"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { getAvatarFallback, isValidMxPhone } from "@/lib/user-account";

type Lang = "zh" | "es";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function RegisterForm({ lang }: { lang: Lang }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registeredUserId, setRegisteredUserId] = useState("");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const text = useMemo(
    () =>
      lang === "zh"
        ? {
            title: "注册账号",
            name: "姓名",
            namePlaceholder: "请输入姓名",
            phone: "手机号",
            phonePlaceholder: "请输入墨西哥手机号",
            password: "登录密码",
            passwordPlaceholder: "请输入登录密码",
            passwordShow: "显示密码",
            passwordHide: "隐藏密码",
            email: "邮箱",
            emailPlaceholder: "请输入邮箱",
            submit: "注册",
            backToLogin: "返回登录",
            loading: "注册中",
            phoneInvalid: "请输入有效的墨西哥手机号",
            avatarTitle: "上传头像图片",
            avatarHint: "可上传头像 也可暂时跳过",
            avatarChoose: "选择图片",
            avatarUpload: "保存头像",
            avatarUploading: "保存中",
            avatarSkip: "取消",
            avatarTooLarge: "头像图片不能超过 2MB",
          }
        : {
            title: "Crear cuenta",
            name: "Nombre",
            namePlaceholder: "Ingresa el nombre",
            phone: "Teléfono",
            phonePlaceholder: "Ingresa el teléfono de México",
            password: "Contraseña",
            passwordPlaceholder: "Ingresa la contraseña",
            passwordShow: "Mostrar contraseña",
            passwordHide: "Ocultar contraseña",
            email: "Correo",
            emailPlaceholder: "Ingresa el correo",
            submit: "Registrar",
            backToLogin: "Volver al inicio de sesion",
            loading: "Registrando",
            phoneInvalid: "Ingresa un teléfono válido de México",
            avatarTitle: "Subir imagen de avatar",
            avatarHint: "Puedes subir el avatar o dejarlo para después",
            avatarChoose: "Seleccionar imagen",
            avatarUpload: "Guardar avatar",
            avatarUploading: "Guardando",
            avatarSkip: "Cancelar",
            avatarTooLarge: "El avatar no puede superar 2 MB",
          },
    [lang],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!isValidMxPhone(phone)) {
      setError(text.phoneInvalid);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, password, email }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Register failed");
        return;
      }

      setRegisteredUserId(data.user.id);
      setShowAvatarModal(true);
    } catch {
      setError(
        lang === "zh"
          ? "当前未能完成注册 请稍后再试"
          : "Por ahora no fue posible completar el registro",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveAvatar() {
    if (!avatarFile || !registeredUserId) {
      router.push("/login");
      router.refresh();
      return;
    }

    try {
      setAvatarLoading(true);
      const avatarDataUrl = await fileToDataUrl(avatarFile);

      const res = await fetch("/api/auth/register/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: registeredUserId,
          avatarDataUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Avatar save failed");
        return;
      }

      router.push("/login");
      router.refresh();
    } catch {
      setError(
        lang === "zh"
          ? "当前未能保存头像 请稍后再试"
          : "Por ahora no fue posible guardar el avatar",
      );
    } finally {
      setAvatarLoading(false);
    }
  }

  function skipAvatar() {
    setShowAvatarModal(false);
    router.push("/login");
    router.refresh();
  }

  function handleAvatarFileChange(file: File | null) {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setError(text.avatarTooLarge);
      return;
    }

    setError("");
    setAvatarFile(file);
  }

  return (
    <>
      <div className="w-full max-w-[560px] rounded-xl bg-white p-6 shadow-soft">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
          {text.title}
        </h1>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {text.name}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={text.namePlaceholder}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {text.phone}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/[^\d+\s()-]/g, ""))
              }
              placeholder={text.phonePlaceholder}
              inputMode="tel"
              autoComplete="tel"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {text.password}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={text.passwordPlaceholder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-11 text-sm outline-none transition focus:border-primary focus:bg-white"
              />
              <button
                type="button"
                aria-label={showPassword ? text.passwordHide : text.passwordShow}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {text.email}
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={text.emailPlaceholder}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? text.loading : text.submit}
          </button>

          <button
            type="button"
            onClick={() => {
              router.push("/login");
              router.refresh();
            }}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {text.backToLogin}
          </button>
        </form>
      </div>

      {showAvatarModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[520px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-center text-base font-semibold text-slate-900">
                {text.avatarTitle}
              </h3>
            </div>

            <div className="px-5 py-5">
              <div className="mb-4 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary-accent text-2xl font-semibold text-primary">
                  {getAvatarFallback(name)}
                </div>
              </div>

              <div className="text-center text-sm text-slate-500">
                {text.avatarHint}
              </div>

              <div className="mt-5">
                <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  {text.avatarChoose}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAvatarFileChange(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              {avatarFile ? (
                <div className="mt-3 text-center text-sm text-slate-500">
                  {avatarFile.name}
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={skipAvatar}
                  className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {text.avatarSkip}
                </button>

                <button
                  type="button"
                  onClick={saveAvatar}
                  disabled={avatarLoading}
                  className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {avatarLoading ? text.avatarUploading : text.avatarUpload}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
