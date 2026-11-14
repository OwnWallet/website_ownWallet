"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card max-w-lg mx-auto mt-10 p-8 text-center space-y-4">
      <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
        <AlertTriangle size={22} />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Không tải được trang này</h2>
        <p className="text-sm text-slate-600">
          Đã xảy ra lỗi khi tải dữ liệu. Số liệu của bạn vẫn an toàn — hãy thử lại.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-500 tabular-nums">Mã lỗi: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={() => retry()} className="btn-primary">
          <RotateCcw size={16} />
          <span>Thử lại</span>
        </button>
        <Link href="/dashboard" className="btn-secondary">
          Về Tổng quan
        </Link>
      </div>
    </div>
  );
}
