"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  isValidPhone,
  PHONE_COUNTRIES,
  type PhoneCountryCode,
} from "@/lib/user-account";

type Lang = "zh" | "es";

export function RegisterForm({ lang }: { lang: Lang }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>("MX");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const text = useMemo(
    () =>
      lang === "zh"
        ? {
            title: "注册账号",
            name: "姓名",
            namePlaceholder: "请输入姓名",
            companyName: "公司名",
            companyNamePlaceholder: "请输入公司名",
            phone: "手机号",
            country: "国家",
            phonePlaceholder: "请输入手机号",
            password: "登录密码",
            passwordPlaceholder: "请输入登录密码",
            passwordShow: "显示密码",
            passwordHide: "隐藏密码",
            email: "邮箱",
            emailPlaceholder: "请输入邮箱",
            inviteCode: "邀请码",
            inviteCodePlaceholder: "请输入邀请码",
            submit: "注册",
            backToLogin: "返回登录",
            loading: "注册中",
            phoneInvalid: "请输入有效的手机号",
            inviteRequired: "请输入邀请码",
          }
        : {
            title: "Crear cuenta",
            name: "Nombre",
            namePlaceholder: "Ingresa el nombre",
            companyName: "Empresa",
            companyNamePlaceholder: "Ingresa la empresa",
            phone: "Teléfono",
            country: "Pais",
            phonePlaceholder: "Ingresa el telefono",
            password: "Contraseña",
            passwordPlaceholder: "Ingresa la contraseña",
            passwordShow: "Mostrar contraseña",
            passwordHide: "Ocultar contraseña",
            email: "Correo",
            emailPlaceholder: "Ingresa el correo",
            inviteCode: "Código de invitación",
            inviteCodePlaceholder: "Ingresa el código de invitación",
            submit: "Registrar",
            backToLogin: "Volver al inicio de sesion",
            loading: "Registrando",
            phoneInvalid: "Ingresa un telefono valido",
            inviteRequired: "Ingresa el código de invitación",
          },
    [lang],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!isValidPhone(phone, phoneCountry)) {
      setError(text.phoneInvalid);
      return;
    }

    if (!inviteCode.trim()) {
      setError(text.inviteRequired);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          companyName,
          phoneCountry,
          phone,
          password,
          email,
          inviteCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Register failed");
        return;
      }

      router.push(data.redirectTo || "/dropshipping?tab=quick_setup");
      router.refresh();
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

  return (
    <div className="w-full max-w-[560px] rounded-xl bg-white p-6 shadow-soft">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
        {text.title}
      </h1>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
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
              {text.companyName}
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={text.companyNamePlaceholder}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {text.phone}
          </label>
          <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition focus-within:border-primary focus-within:bg-white">
            <select
              value={phoneCountry}
              onChange={(e) => setPhoneCountry(e.target.value as PhoneCountryCode)}
              className="h-11 min-w-[138px] border-r border-slate-200 bg-transparent px-3 text-sm text-slate-700 outline-none"
            >
              {PHONE_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {lang === "zh" ? country.labelZh : country.labelEs} {country.dialCode}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/[^\d\s()-]/g, ""))
              }
              placeholder={text.phonePlaceholder}
              inputMode="tel"
              autoComplete="tel"
              className="h-11 w-full bg-transparent px-3.5 text-sm outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {text.inviteCode}
          </label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder={text.inviteCodePlaceholder}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm uppercase outline-none transition focus:border-primary focus:bg-white"
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
  );
}
