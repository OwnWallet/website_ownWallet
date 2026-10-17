"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Scissors,
  X,
  Layers,
  Loader2,
  Calendar,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getDebtLogs, splitDebtByLog, splitDebtByAmount } from "@/actions/debts";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";
import { toast } from "sonner";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface DebtSplitModalProps {
  debt: {
    id: string;
    person: string;
    amount: number | string;
    paidAmount: number | string;
    direction: "OWE" | "OWED";
    dueDate?: string | null;
    note?: string | null;
  };
  triggerButton?: React.ReactNode;
}

export function DebtSplitModal({ debt, triggerButton }: DebtSplitModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "custom">("logs");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [splittingLogId, setSplittingLogId] = useState<string | null>(null);

  // Danh sách các log TOPUP
  const [topupLogs, setTopupLogs] = useState<any[]>([]);

  // Tùy chỉnh người nhận cho từng log
  const [logPersons, setLogPersons] = useState<Record<string, string>>({});

  // Form state cho Tab tách số tiền tùy chỉnh
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [customPerson, setCustomPerson] = useState<string>(debt.person);
  const [customDueDate, setCustomDueDate] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");

  const mounted = useMounted();
  const totalAmount = Number(debt.amount);
  const paidAmount = Number(debt.paidAmount || 0);
  const remainAmount = Math.max(0, totalAmount - paidAmount);

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await getDebtLogs(debt.id);
      if (res?.logs) {
        const topups = res.logs.filter((l: any) => l.type === "TOPUP");
        setTopupLogs(topups);
        // Default target person to debt.person
        const map: Record<string, string> = {};
        topups.forEach((l: any) => {
          map[l.id] = debt.person;
        });
        setLogPersons(map);

        // Nếu không có TOPUP logs, tự động chuyển sang tab tùy chỉnh
        if (topups.length === 0) {
          setActiveTab("custom");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải lịch sử gộp nợ");
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setCustomPerson(debt.person);
    setCustomAmount(0);
    setCustomNote("");
    setCustomDueDate("");
    loadLogs();
  };

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleSplitLog = async (logId: string) => {
    const targetPerson = (logPersons[logId] || debt.person).trim();
    if (!targetPerson) {
      toast.warning("Vui lòng nhập tên đối tác cho khoản nợ mới");
      return;
    }

    setSplittingLogId(logId);
    try {
      const res = await splitDebtByLog(debt.id, logId, targetPerson);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Đã tách khoản nợ riêng thành công cho "${targetPerson}"!`);
        setIsOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Đã xảy ra lỗi khi tách khoản nợ");
    } finally {
      setSplittingLogId(null);
    }
  };

  const handleSplitCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customAmount <= 0) {
      toast.warning("Vui lòng nhập số tiền hợp lệ (> 0)");
      return;
    }
    if (customAmount >= totalAmount) {
      toast.warning(`Số tiền tách (${formatCurrency(customAmount)}) phải nhỏ hơn tổng nợ (${formatCurrency(totalAmount)})`);
      return;
    }
    const targetPerson = customPerson.trim();
    if (!targetPerson) {
      toast.warning("Vui lòng nhập tên đối tác");
      return;
    }

    setSubmitting(true);
    try {
      const res = await splitDebtByAmount(
        debt.id,
        customAmount,
        targetPerson,
        customNote,
        customDueDate || undefined
      );
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `Đã tách thành công khoản nợ ${formatCurrency(customAmount)} cho "${targetPerson}"!`
        );
        setIsOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Đã xảy ra lỗi khi tách khoản nợ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {triggerButton ? (
        <div onClick={handleOpen} className="inline-block">
          {triggerButton}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          title="Tách khoản nợ này ra thành các khoản nợ độc lập"
          aria-label="Tách khoản nợ"
          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <Scissors size={13} />
        </button>
      )}

      {mounted && isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-card border border-border shadow-2xl rounded-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden animate-scale-in text-foreground"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0 border border-rose-500/25">
                  <Scissors size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <span>Tách / Hủy gộp khoản nợ</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {debt.person} — Tổng nợ: {formatCurrency(totalAmount)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submitting || Boolean(splittingLogId)}
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Overview Strip */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-border text-xs shrink-0 flex-wrap gap-2">
              <div>
                <span className="text-muted-foreground">Tổng nợ gốc: </span>
                <strong className="text-foreground">{formatCurrency(totalAmount)}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Đã trả: </span>
                <strong className="text-emerald-600">{formatCurrency(paidAmount)}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Còn lại: </span>
                <strong className="text-rose-600">{formatCurrency(remainAmount)}</strong>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-5 pt-3 bg-card shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "logs"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers size={13} />
                <span>Theo đợt gộp ({topupLogs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("custom")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "custom"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Scissors size={13} />
                <span>Tách số tiền tùy chỉnh</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {activeTab === "logs" ? (
                loadingLogs ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="text-xs">Đang tải lịch sử gộp nợ...</span>
                  </div>
                ) : topupLogs.length === 0 ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground flex items-center justify-center text-lg">
                      📋
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-foreground">Không có lịch sử gộp tiền (TOPUP)</h4>
                      <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                        Khoản nợ này chưa từng được gộp thêm tiền. Bạn có thể chuyển sang tab{" "}
                        <button
                          type="button"
                          onClick={() => setActiveTab("custom")}
                          className="text-primary font-bold hover:underline cursor-pointer"
                        >
                          Tách số tiền tùy chỉnh
                        </button>{" "}
                        để chia nợ ra.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Dưới đây là các lần gộp thêm tiền vào khoản nợ này. Nhấn <strong>Tách nợ riêng</strong> để khôi phục khoản đó thành một hồ sơ nợ riêng biệt:
                    </p>

                    {topupLogs.map((log) => {
                      const logAmt = Number(log.amount);
                      const isSplitting = splittingLogId === log.id;
                      const currentTargetPerson = logPersons[log.id] ?? debt.person;

                      return (
                        <div
                          key={log.id}
                          className="p-3.5 rounded-xl border border-border bg-card space-y-2.5 shadow-2xs text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-sm text-rose-600">
                              +{formatCurrency(logAmt)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              📅 {formatDate(log.recordedAt || log.createdAt)}
                            </span>
                          </div>

                          {log.note && (
                            <p className="text-[11px] text-muted-foreground bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-border/60 italic">
                              {log.note}
                            </p>
                          )}

                          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                            <div className="flex-1">
                              <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                                Tên đối tác cho nợ mới:
                              </label>
                              <input
                                type="text"
                                value={currentTargetPerson}
                                onChange={(e) =>
                                  setLogPersons((prev) => ({ ...prev, [log.id]: e.target.value }))
                                }
                                className="w-full text-xs font-semibold rounded-lg border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-hidden"
                                placeholder="Nhập tên người..."
                              />
                            </div>
                            <div className="shrink-0 self-end">
                              <button
                                type="button"
                                disabled={isSplitting || submitting}
                                onClick={() => handleSplitLog(log.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                {isSplitting ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Scissors size={12} />
                                )}
                                <span>Tách nợ riêng</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <form onSubmit={handleSplitCustom} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Số tiền muốn tách <span className="text-rose-500">*</span>
                    </label>
                    <SmartCurrencyInput
                      value={customAmount}
                      onChangeValue={(val) => setCustomAmount(val)}
                      showQuickButtons
                      showWordsPreview
                      maxAmount={totalAmount - 1}
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Nợ gốc còn lại sau tách:</span>
                      <strong className="text-foreground">
                        {formatCurrency(Math.max(0, totalAmount - customAmount))}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Tên đối tác khoản nợ mới <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customPerson}
                      onChange={(e) => setCustomPerson(e.target.value)}
                      placeholder="Nhập tên đối tác hoặc người vay..."
                      className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Calendar size={13} />
                      <span>Hạn trả nợ mới (tùy chọn)</span>
                    </label>
                    <input
                      type="date"
                      value={customDueDate}
                      onChange={(e) => setCustomDueDate(e.target.value)}
                      className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Ghi chú bổ sung
                    </label>
                    <textarea
                      rows={2}
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder={`Tách số tiền từ khoản nợ của ${debt.person}...`}
                      className="w-full text-xs rounded-xl border border-border bg-background p-2.5 text-foreground focus:border-primary focus:outline-hidden resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting || customAmount <= 0 || customAmount >= totalAmount}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Đang thực hiện tách nợ...</span>
                        </>
                      ) : (
                        <>
                          <Scissors size={14} />
                          <span>Xác nhận tách {formatCurrency(customAmount)}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 border-t border-border bg-card flex items-center justify-end shrink-0">
              <button
                type="button"
                disabled={submitting || Boolean(splittingLogId)}
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
