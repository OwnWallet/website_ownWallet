import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng ký",
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Tạo tài khoản</h1>
        <p className="text-muted text-center">— Form sẽ được build ở Phase 2 —</p>
      </div>
    </main>
  );
}
