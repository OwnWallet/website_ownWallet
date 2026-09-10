"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerAction } from "@/actions/auth";
import { ArrowRight, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerAction, null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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
        <div className="text-center mb-8 flex flex-col items-center">
          <Link href="/" className="inline-block mb-3 group">
            <Image
              src="/logo-transparent.png"
              alt="OwnWallet Logo"
              width={240}
              height={70}
              className="h-16 w-auto object-contain mx-auto group-hover:scale-105 transition-transform"
              priority
            />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Tạo tài khoản mới
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1.5">
            Bắt đầu quản lý tài chính thông minh với <span className="font-semibold text-orange-500">OwnWallet</span>
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

          {/* Đăng ký nhanh bằng Google */}
          <button
            type="button"
            disabled={isGoogleLoading || isPending}
            onClick={async () => {
              try {
                setIsGoogleLoading(true);
                await signIn("google", { callbackUrl: "/dashboard" });
              } catch (err) {
                console.error("Google sign in error:", err);
                setIsGoogleLoading(false);
              }
            }}
            className="w-full py-2.5 px-4 bg-[var(--background-elevated)] hover:bg-[var(--background)] border border-[var(--border-strong)] hover:border-orange-500/40 rounded-lg text-sm font-medium text-[var(--foreground)] flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                <span>Đang chuyển hướng tới Google...</span>
              </>
            ) : (
              <>
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
                <span>Đăng ký nhanh bằng Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-strong)]" />
            </div>
            <span className="relative px-3 bg-[var(--background-elevated)] text-xs text-[var(--foreground-subtle)] uppercase tracking-wider font-medium">
              hoặc điền thông tin
            </span>
          </div>

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

          {/* Whitelist Note */}
          <div className="mt-6 pt-4 border-t border-[var(--border-strong)] text-[11px] text-[var(--foreground-subtle)] text-center flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>Chỉ các email trong Whitelist mới được cấp quyền đăng ký</span>
          </div>
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
