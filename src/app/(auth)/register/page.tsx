"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerAction } from "@/actions/auth";
import { Wallet, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerAction, null);

  useEffect(() => {
    if (state?.success) {
      router.push("/login?registered=1");
    }
  }, [state?.success, router]);

  const generalError = typeof state?.error === "string" ? state.error : null;
  const fieldErrors = typeof state?.error === "object" ? state.error : null;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 mb-4 shadow-lg shadow-orange-500/10">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Tạo tài khoản mới
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1.5">
            Bắt đầu quản lý tài chính thông minh với <span className="font-semibold text-orange-500">wnWallet</span>
          </p>
        </div>

        {/* Form Card */}
        <div className="card shadow-2xl backdrop-blur-sm border-[var(--border-strong)] p-6 sm:p-8">
          {generalError && (
            <div className="flex items-center gap-2.5 p-3.5 mb-6 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5"
              >
                Họ và tên
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Nguyễn Văn A"
                className="w-full px-3.5 py-2.5 bg-[var(--background-elevated)] border border-[var(--border-strong)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
              {fieldErrors?.name && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.name[0]}</p>
              )}
            </div>

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
                required
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-[var(--background-elevated)] border border-[var(--border-strong)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
              {fieldErrors?.email && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.email[0]}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5"
              >
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Ít nhất 6 ký tự"
                className="w-full px-3.5 py-2.5 bg-[var(--background-elevated)] border border-[var(--border-strong)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
              {fieldErrors?.password && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.password[0]}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-1.5"
              >
                Xác nhận mật khẩu
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                placeholder="Nhập lại mật khẩu"
                className="w-full px-3.5 py-2.5 bg-[var(--background-elevated)] border border-[var(--border-strong)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
              {fieldErrors?.confirmPassword && (
                <p className="text-xs text-rose-500 mt-1">
                  {fieldErrors.confirmPassword[0]}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:from-orange-700 active:to-amber-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-600/20 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>Tạo tài khoản</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Navigation */}
        <p className="text-center text-xs text-[var(--foreground-muted)] mt-6">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="font-medium text-orange-500 hover:text-orange-400 transition-colors"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
