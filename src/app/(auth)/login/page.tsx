"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/actions/auth";
import { Wallet, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const errorMessage =
    typeof state?.error === "string"
      ? state.error
      : state?.error
      ? Object.values(state.error).flat().join(", ")
      : null;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 mb-4 shadow-lg shadow-orange-500/10">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Chào mừng trở lại
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1.5">
            Đăng nhập vào ví cá nhân <span className="font-semibold text-orange-500">wnWallet</span>
          </p>
        </div>

        {/* Form Card */}
        <div className="card shadow-2xl backdrop-blur-sm border-[var(--border-strong)] p-6 sm:p-8">
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3.5 mb-6 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue="demo@wnwallet.dev"
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-[var(--background-elevated)] border border-[var(--border-strong)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]"
                >
                  Mật khẩu
                </label>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                defaultValue="demo123456"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-[var(--background-elevated)] border border-[var(--border-strong)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:from-orange-700 active:to-amber-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-600/20 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Info */}
          <div className="mt-6 pt-5 border-t border-[var(--border-strong)] text-xs text-[var(--foreground-muted)] text-center">
            <span className="bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded font-mono">
              demo@wnwallet.dev
            </span>{" "}
            /{" "}
            <span className="bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded font-mono">
              demo123456
            </span>
          </div>
        </div>

        {/* Footer Navigation */}
        <p className="text-center text-xs text-[var(--foreground-muted)] mt-6">
          Chưa có tài khoản?{" "}
          <Link
            href="/register"
            className="font-medium text-orange-500 hover:text-orange-400 transition-colors"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </main>
  );
}
