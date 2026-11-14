import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-page)]">
      <div className="card max-w-md w-full p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-xl bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center">
          <Compass size={22} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 tabular-nums">404</p>
          <h1 className="text-lg font-bold text-foreground">Không tìm thấy trang</h1>
          <p className="text-sm text-slate-600">Đường dẫn này không tồn tại hoặc đã được di chuyển.</p>
        </div>
        <Link href="/dashboard" className="btn-primary inline-flex">
          Về Tổng quan
        </Link>
      </div>
    </main>
  );
}
