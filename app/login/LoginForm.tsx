"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type Lang = "zh" | "es";

export function LoginForm({ lang }: { lang: Lang }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const text = useMemo(
    () =>
      lang === "zh"
        ? {
            title: "登录 ParksonIM",
            account: "账号或手机号",
            accountPlaceholder: "请输入账号或手机号",
            password: "登录密码",
            passwordPlaceholder: "请输入密码",
            submit: "登录",
            loading: "登录中",
            loginFailed: "登录失败",
            loginUnavailable: "当前未能完成登录，请稍后再试",
            showPassword: "显示密码",
            hidePassword: "隐藏密码",
          }
        : {
            title: "Acceder a ParksonIM",
            account: "Cuenta o teléfono",
            accountPlaceholder: "Ingresa la cuenta o el teléfono",
            password: "Contraseña",
            passwordPlaceholder: "Ingresa la contraseña",
            submit: "Entrar",
            loading: "Ingresando",
            loginFailed: "Acceso fallido",
            loginUnavailable: "Por ahora no fue posible iniciar sesión",
            showPassword: "Mostrar contraseña",
            hidePassword: "Ocultar contraseña",
          },
    [lang],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || text.loginFailed);

        if (process.env.NODE_ENV !== "production" && data?.details) {
          console.error("[login] api details:", data.details);
        }
        return;
      }

      const next = searchParams.get("next");
      router.push(next || "/dashboard");
      router.refresh();
    } catch (caughtError) {
      console.error("[login] request failed:", caughtError);
      setError(text.loginUnavailable);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[480px] rounded-xl bg-white p-6 shadow-soft">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
        {text.title}
      </h1>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {text.account}
          </label>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={text.accountPlaceholder}
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
              aria-label={showPassword ? text.hidePassword : text.showPassword}
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
      </form>
    </div>
  );
}
