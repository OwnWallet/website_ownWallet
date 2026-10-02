"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { History, X, Link2, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { getDebtLogs } from "@/actions/debts";

type DebtLogWithTx = {
  id: string;
  type: "INIT" | "TOPUP" | "PAYMENT" | "NOTE";
  amount: string | null;
  note: string | null;
  txId: string | null;
  recordedAt: string;
  createdAt: string;
  // Enriched transaction info from the action
  tx?: {
    id: string;
    amount: number;
    note: string | null;
    type: string;
    recordedAt: string;
    category?: {
      name: string;
      icon: string | null;
      color: string;
    } | null;
  } | null;
};

const LOG_CONFIG: Record<
  DebtLogWithTx["type"],
  { label: string; description: string; badgeClass: string; dotClass: string; cardClass: string; icon: string }
> = {
  INIT: {
    label: "Khởi tạo",
    description: "Khoản nợ được ghi nhận lần đầu",
    badgeClass: "bg-violet-100 text-violet-700 border-violet-200",
    dotClass: "bg-violet-500 border-white",
    cardClass: "bg-violet-50/60 border-violet-200/60",
    icon: "🆕",
  },
  TOPUP: {
    label: "Cộng thêm",
    description: "Gộp thêm khoản tiền vào nợ",
    badgeClass: "bg-rose-100 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500 border-white",
    cardClass: "bg-rose-50/60 border-rose-200/60",
    icon: "➕",
  },
  PAYMENT: {
    label: "Trả nợ",
    description: "Ghi nhận khoản thanh toán",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500 border-white",
    cardClass: "bg-emerald-50/60 border-emerald-200/60",
    icon: "✅",
  },
  NOTE: {
    label: "Ghi chú",
    description: "Ghi chú bổ sung",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400 border-white",
    cardClass: "bg-slate-50/60 border-slate-200/60",
    icon: "📝",
  },
};

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function DebtLogModal({
  debtId,
  debtPerson,
  debtAmount,
  debtPaidAmount,
}: {
  debtId: string;
  debtPerson: string;
  debtAmount?: number;
  debtPaidAmount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<DebtLogWithTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getDebtLogs(debtId);
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error as string);
    } else if (result.logs) {
      setLogs(result.logs as DebtLogWithTx[]);
    }
  }, [debtId]);

  const handleOpen = () => {
    setOpen(true);
    loadLogs();
  };

  const handleClose = () => setOpen(false);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const remaining = debtAmount !== undefined && debtPaidAmount !== undefined
    ? Math.max(0, debtAmount - debtPaidAmount)
    : null;

  const totalPaid = logs
    .filter((l) => l.type === "PAYMENT")
    .reduce((sum, l) => sum + (l.amount ? Number(l.amount) : 0), 0);

  const trigger = (
    <button
      type="button"
      title="Xem lịch sử khoản nợ"
      aria-label="Xem lịch sử khoản nợ"
      onClick={handleOpen}
      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
    >
      <History size={13} />
    </button>
  );

  if (!mounted || !open) return trigger;

  return (
    <>
      {trigger}
      {createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={handleClose} aria-hidden />

          {/* Modal panel */}
          <div
            className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in z-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debt-log-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <History size={16} className="text-primary" />
                </div>
                <div>
                  <h2 id="debt-log-title" className="font-bold text-base text-foreground">
                    Lịch sử khoản nợ
                  </h2>
                  <p className="text-xs text-muted-foreground">{debtPerson}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Đóng"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Summary strip */}
            {(debtAmount !== undefined || totalPaid > 0) && (
              <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-border/60 text-xs shrink-0">
                {debtAmount !== undefined && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Tổng nợ:</span>
                    <span className="font-bold text-foreground">{formatCurrency(debtAmount)}</span>
                  </div>
                )}
                {totalPaid > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Đã trả:</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(totalPaid)}</span>
                    </div>
                  </>
                )}
                {remaining !== null && remaining > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Còn lại:</span>
                      <span className="font-bold text-rose-600">{formatCurrency(remaining)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-14 text-muted-foreground">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Đang tải lịch sử...</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-rose-600 text-center py-10 justify-center">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {!loading && !error && logs.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-14">
                  Chưa có lịch sử nào.
                </p>
              )}

              {!loading && !error && logs.length > 0 && (
                <ol className="relative border-l-2 border-border ml-2 space-y-1 pb-2">
                  {logs.map((log) => {
                    const cfg = LOG_CONFIG[log.type];
                    return (
                      <li key={log.id} className="relative pl-7 pb-5 last:pb-0">
                        {/* Timeline dot — positioned relative to this <li> */}
                        <span
                          className={`absolute left-0 top-1 -translate-x-[calc(50%+1px)] w-3.5 h-3.5 rounded-full border-2 shadow-sm z-10 ${cfg.dotClass}`}
                          aria-hidden="true"
                        />

                        {/* Event card */}
                        <div
                          className={`rounded-xl border p-3.5 space-y-2.5 ${cfg.cardClass}`}
                        >
                          {/* Top: badge + amount */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base leading-none">{cfg.icon}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${cfg.badgeClass}`}
                              >
                                {cfg.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{cfg.description}</span>
                            </div>
                            {log.amount && (
                              <span
                                className={`text-sm font-extrabold shrink-0 ${
                                  log.type === "PAYMENT"
                                    ? "text-emerald-600"
                                    : log.type === "TOPUP"
                                    ? "text-rose-600"
                                    : "text-foreground"
                                }`}
                              >
                                {log.type === "PAYMENT" ? "−" : log.type === "TOPUP" ? "+" : ""}
                                {formatCurrency(Number(log.amount))}
                              </span>
                            )}
                          </div>

                          {/* Description box */}
                          <div className="text-xs text-foreground bg-white/70 dark:bg-slate-900/60 rounded-xl p-3 border border-border/70 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              <span className="flex items-center gap-1 text-primary">
                                <span>📝</span>
                                <span>Mô tả chi tiết</span>
                              </span>
                              <span className="font-normal normal-case text-muted-foreground text-[10px]">
                                {formatDateTime(log.recordedAt || log.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-foreground font-medium pt-0.5">
                              {log.note
                                ? log.note.replace(/\[SCHEDULE:.*?\]/g, "").trim()
                                : log.type === "PAYMENT"
                                ? `Ghi nhận thanh toán ${formatCurrency(Number(log.amount))} liên quan đến ${debtPerson}`
                                : log.type === "TOPUP"
                                ? `Cộng thêm ${formatCurrency(Number(log.amount))} vào khoản nợ`
                                : log.type === "INIT"
                                ? `Khởi tạo khoản nợ ${formatCurrency(Number(log.amount))} với ${debtPerson}`
                                : "Cập nhật thông tin khoản nợ"}
                            </p>
                          </div>

                          {/* Linked transaction card */}
                          {log.txId && (
                            <div className="rounded-lg border border-border/70 bg-white/60 dark:bg-slate-900/40 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Link2 size={11} className="text-muted-foreground shrink-0" />
                                  {log.tx ? (
                                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                      {log.tx.category?.icon && (
                                        <span className="text-sm shrink-0">{log.tx.category.icon}</span>
                                      )}
                                      <span className="text-xs font-semibold text-foreground truncate">
                                        {log.tx.category?.name ?? "Giao dịch"}
                                      </span>
                                      {log.tx.note && (
                                        <span className="text-[11px] text-muted-foreground italic truncate max-w-[120px]">
                                          — {log.tx.note}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      GD: {log.txId.slice(-8)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {log.tx && (
                                    <span
                                      className={`text-xs font-bold ${
                                        log.tx.type === "INCOME" ? "text-emerald-600" : "text-rose-600"
                                      }`}
                                    >
                                      {formatCurrency(log.tx.amount)}
                                    </span>
                                  )}
                                  <Link
                                    href={`/transactions/${log.txId}/edit`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 bg-primary/8 hover:bg-primary/15 px-2 py-1 rounded-md border border-primary/20 transition-all"
                                    title="Mở giao dịch liên kết"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink size={9} />
                                    Xem
                                  </Link>
                                </div>
                              </div>
                              {log.tx?.recordedAt && (
                                <div className="px-3 pb-2 text-[10px] text-muted-foreground">
                                  📅 {formatDate(log.tx.recordedAt)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Timestamp */}
                          <time
                            className="text-[10px] text-muted-foreground block"
                            dateTime={log.recordedAt}
                          >
                            🕐 {formatDateTime(log.recordedAt)}
                          </time>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {logs.length} sự kiện được ghi nhận
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
