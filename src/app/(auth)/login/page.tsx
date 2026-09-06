"use client";

import { useActionState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction, loginWithGoogle } from "@/actions/auth";
import { Wallet, ArrowRight, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const searchParams = useSearchParams();

  const urlError = searchParams.get("error");
  let urlErrorMessage: string | null = null;
  if (urlError === "AccessDenied") {
    urlErrorMessage =
      "Email của bạn chưa được cấp quyền truy cập (không nằm trong danh sách Whitelist). Vui lòng đăng nhập bằng email đã được cấp quyền.";
  } else if (urlError === "OAuthSignin" || urlError === "OAuthCallbackError") {
    urlErrorMessage = "Đã xảy ra lỗi khi xác thực với Google. Vui lòng kiểm tra lại.";
  }

  const errorMessage =
    urlErrorMessage ||
    (typeof state?.error === "string"
      ? state.error
      : state?.error
      ? Object.values(state.error).flat().join(", ")
      : null);

  const registered = searchParams.get("registered");

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
          {registered && !errorMessage && (
            <div className="flex items-center gap-2.5 p-3.5 mb-6 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg animate-fade-in">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Đăng ký tài khoản thành công. Vui lòng đăng nhập.</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 mb-6 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Đăng nhập bằng Google */}
          <form action={loginWithGoogle}>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[var(--background-elevated)] hover:bg-[var(--background)] border border-[var(--border-strong)] hover:border-orange-500/40 rounded-lg text-sm font-medium text-[var(--foreground)] flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer active:scale-[0.99]"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Tiếp tục với Google</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-strong)]" />
            </div>
            <span className="relative px-3 bg-[var(--background-elevated)] text-xs text-[var(--foreground-subtle)] uppercase tracking-wider font-medium">
              hoặc mật khẩu
            </span>
          </div>

          {/* Credentials Form */}
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

          {/* Whitelist Note */}
          <div className="mt-6 pt-4 border-t border-[var(--border-strong)] text-[11px] text-[var(--foreground-subtle)] text-center flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>Hệ thống bảo vệ bằng danh sách Email Whitelist</span>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
