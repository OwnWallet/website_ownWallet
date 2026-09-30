"use client";

import { useState, useCallback } from "react";
import { History, X, Link2, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getDebtLogs } from "@/actions/debts";

type DebtLog = {
  id: string;
  type: "INIT" | "TOPUP" | "PAYMENT" | "NOTE";
  amount: string | null;
  note: string | null;
  txId: string | null;
  recordedAt: string;
  createdAt: string;
};

const LOG_CONFIG: Record<
  DebtLog["type"],
  { label: string; color: string; bg: string; icon: string }
> = {
  INIT: {
    label: "Khởi tạo",
    color: "var(--color-primary, #7c3aed)",
    bg: "color-mix(in srgb, var(--color-primary, #7c3aed) 12%, transparent)",
    icon: "🆕",
  },
  TOPUP: {
    label: "Cộng thêm",
    color: "var(--color-expense, #ef4444)",
    bg: "color-mix(in srgb, var(--color-expense, #ef4444) 12%, transparent)",
    icon: "➕",
  },
  PAYMENT: {
    label: "Trả nợ",
    color: "var(--color-income, #22c55e)",
    bg: "color-mix(in srgb, var(--color-income, #22c55e) 12%, transparent)",
    icon: "✅",
  },
  NOTE: {
    label: "Ghi chú",
    color: "var(--foreground-subtle)",
    bg: "color-mix(in srgb, var(--foreground-subtle) 12%, transparent)",
    icon: "📝",
  },
};

export function DebtLogModal({
  debtId,
  debtPerson,
}: {
  debtId: string;
  debtPerson: string;
}) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<DebtLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getDebtLogs(debtId);
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error as string);
    } else if (result.logs) {
      setLogs(result.logs as DebtLog[]);
    }
  }, [debtId]);

  const handleOpen = () => {
    setOpen(true);
    loadLogs();
  };

  if (!open) {
    return (
      <button
        type="button"
        title="Xem lịch sử khoản nợ"
        aria-label="Xem lịch sử khoản nợ"
        onClick={handleOpen}
        className="p-1 rounded text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <History size={13} />
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-log-title"
      >
        <div
          className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <History size={18} className="text-primary" />
              <div>
                <h2 id="debt-log-title" className="font-bold text-base">
                  Lịch sử khoản nợ
                </h2>
                <p className="text-xs text-muted">{debtPerson}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="p-1.5 rounded hover:bg-elevated transition-colors text-muted hover:text-foreground cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-5 py-4">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-muted">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Đang tải lịch sử...</span>
              </div>
            )}

            {error && (
              <div className="text-sm text-danger text-center py-8">{error}</div>
            )}

            {!loading && !error && logs.length === 0 && (
              <p className="text-sm text-center text-muted py-12">
                Chưa có lịch sử nào.
              </p>
            )}

            {!loading && !error && logs.length > 0 && (
              <ol className="relative border-l border-border-strong ml-3 space-y-0">
                {logs.map((log, idx) => {
                  const cfg = LOG_CONFIG[log.type];
                  const isLast = idx === logs.length - 1;
                  return (
                    <li key={log.id} className={`pl-6 ${isLast ? "pb-0" : "pb-5"}`}>
                      {/* Dot */}
                      <span
                        className="absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full text-[9px] shadow"
                        style={{ backgroundColor: cfg.color, top: `${idx === 0 ? 2 : 0}px`, marginTop: idx === 0 ? 0 : `${idx * 0}px` }}
                        aria-hidden="true"
                      >
                        {cfg.icon}
                      </span>

                      <div
                        className="rounded-lg p-3 border"
                        style={{
                          backgroundColor: cfg.bg,
                          borderColor: `color-mix(in srgb, ${cfg.color} 25%, transparent)`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <span
                            className="text-xs font-bold"
                            style={{ color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                          {log.amount && (
                            <span className="text-sm font-extrabold" style={{ color: cfg.color }}>
                              {log.type === "PAYMENT" ? "−" : "+"}{formatCurrency(Number(log.amount))}
                            </span>
                          )}
                        </div>

                        {log.note && (
                          <p className="text-xs text-muted mt-1">{log.note}</p>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                          <time className="text-[10px] text-muted" dateTime={log.recordedAt}>
                            {formatDate(log.recordedAt)}
                          </time>
                          {log.txId && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-muted bg-elevated px-1.5 py-0.5 rounded font-mono"
                              title={`Giao dịch liên kết: ${log.txId}`}
                            >
                              <Link2 size={9} />
                              GD: {log.txId.slice(-8)}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border shrink-0">
            <p className="text-xs text-muted text-center">
              {logs.length} sự kiện được ghi nhận
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
