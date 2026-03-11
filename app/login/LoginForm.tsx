"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Lang = "zh" | "es";

export function LoginForm({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
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
            register: "注册新账号",
          }
        : {
            title: "Acceder a ParksonIM",
            account: "Cuenta o teléfono",
            accountPlaceholder: "Ingresa la cuenta o el teléfono",
            password: "Contraseña",
            passwordPlaceholder: "Ingresa la contraseña",
            submit: "Entrar",
            loading: "Ingresando",
            register: "Crear cuenta",
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
        setError(data.error || (lang === "zh" ? "登录失败" : "Acceso fallido"));
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(
        lang === "zh"
          ? "当前未能完成登录 请稍后再试"
          : "Por ahora no fue posible iniciar sesión",
      );
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
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={text.passwordPlaceholder}
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
      </form>

      <div className="mt-4 flex justify-center">
        <Link
          href="/register"
          className="text-sm font-medium text-primary transition hover:opacity-80"
        >
          {text.register}
        </Link>
      </div>
    </div>
  );
}
