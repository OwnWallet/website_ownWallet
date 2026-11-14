"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getAiStatus, type AiStatus } from "@/actions/import-tools";

const STYLES: Record<AiStatus["state"], { dot: string; box: string }> = {
  ready: { dot: "bg-emerald-500", box: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  slow: { dot: "bg-amber-500", box: "bg-amber-50 text-amber-800 border-amber-200" },
  error: { dot: "bg-rose-500", box: "bg-rose-50 text-rose-800 border-rose-200" },
  unconfigured: { dot: "bg-slate-400", box: "bg-slate-50 text-slate-700 border-slate-200" },
  local: { dot: "bg-sky-500", box: "bg-sky-50 text-sky-800 border-sky-200" },
};

/**
 * Hiển thị trạng thái AI cho model đang chọn (kiểm tra thật bằng một lệnh ping, có cache phía server).
 */
export function AiStatusBadge({ model }: { model: string }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        setStatus(await getAiStatus(model, force));
      } catch {
        setStatus({
          state: "error",
          model,
          message: "Không thể kiểm tra trạng thái AI",
          checkedAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    },
    [model]
  );

  useEffect(() => {
    // Kiểm tra lại mỗi khi đổi model (kết quả được cache phía server vài phút)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check(false);
  }, [check]);

  const style = status ? STYLES[status.state] : STYLES.unconfigured;

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-medium ${style.box}`}
      role="status"
      aria-live="polite"
      title={status ? `${status.model} · kiểm tra lúc ${new Date(status.checkedAt).toLocaleTimeString("vi-VN")}` : undefined}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${loading ? "bg-slate-300 animate-pulse" : style.dot}`} />
      <span className="max-w-[320px] truncate">
        {loading && !status ? "Đang kiểm tra AI…" : status?.message ?? "Đang kiểm tra AI…"}
      </span>
      {status && status.state !== "local" && (
        <button
          type="button"
          onClick={() => check(true)}
          disabled={loading}
          className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer disabled:cursor-wait"
          aria-label="Kiểm tra lại trạng thái AI"
          title="Kiểm tra lại"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
      )}
    </div>
  );
}
