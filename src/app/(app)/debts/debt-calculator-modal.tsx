"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Calculator, X, TrendingDown, Calendar, Percent, DollarSign, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { parseDebtMetadata, calculateDebtAmortization } from "@/lib/debt-schedule";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export interface DebtCalculatorModalProps {
  debt?: {
    id: string;
    person: string;
    amount: number | string;
    paidAmount?: number | string;
    direction?: "OWE" | "OWED";
    dueDate?: string | null;
    createdAt?: string | null;
    note?: string | null;
  };
  trigger?: React.ReactNode;
}

export function DebtCalculatorModal({ debt, trigger }: DebtCalculatorModalProps) {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();

  const meta = parseDebtMetadata(debt?.note);
  const isDebtMode = Boolean(debt);
  const isOwe = debt?.direction !== "OWED"; // true = OWE (tôi nợ), false = OWED (người khác nợ tôi)

  const initialAmount = debt ? String(Number(debt.amount) || 0) : "10000000";
  const initialRate = meta.schedule?.rate ? String(meta.schedule.rate) : meta.schedule?.hasInterest ? "12" : "0";
  const initialRateType = meta.schedule?.rateType || "year";
  const initialMonths = meta.schedule?.months ? String(meta.schedule.months) : "12";
  const initialMethod = meta.schedule?.method || "annuity";

  const [principal, setPrincipal] = useState<string>(initialAmount);
  const [annualRate, setAnnualRate] = useState<string>(initialRate);
  const [rateType, setRateType] = useState<"year" | "month">(initialRateType);
  const [months, setMonths] = useState<string>(initialMonths);
  const [type, setType] = useState<"annuity" | "linear">(initialMethod);
  const [showTable, setShowTable] = useState(true);

  const principalNum = parseFloat(principal.replace(/[^\d.]/g, "")) || 0;
  const rateNum = parseFloat(annualRate) || 0;
  const monthsNum = Math.max(1, Math.min(360, parseInt(months) || 12));
  const paidNum = debt ? Number(debt.paidAmount || 0) : 0;

  const { rows, monthlyPayment, totalPayment, totalInterest } = calculateDebtAmortization(
    principalNum,
    rateNum,
    rateType,
    monthsNum,
    type,
    debt?.dueDate || debt?.createdAt || new Date(),
    paidNum
  );

  const firstInterest = rows[0]?.interest ?? 0;
  const paidRowsCount = rows.filter((r) => r.isPaid).length;

  function handleClose() {
    setOpen(false);
  }

  const defaultTrigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center gap-2 border border-border bg-card hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground active:scale-95"
      title="Tính toán lãi suất và lịch trả nợ"
    >
      <Calculator size={14} className="text-violet-500 shrink-0" />
      <span>Tính lãi & lịch trả</span>
    </button>
  );

  const finalTrigger = trigger ? (
    <div onClick={() => setOpen(true)} className="inline-block cursor-pointer">
      {trigger}
    </div>
  ) : (
    defaultTrigger
  );

  if (!mounted) return finalTrigger;

  return (
    <>
      {finalTrigger}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={handleClose} aria-hidden />
            <div
              className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col animate-scale-in z-10"
              role="dialog"
              aria-modal="true"
              aria-labelledby="calc-title"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center shrink-0">
                    <Calculator size={16} className="text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h2 id="calc-title" className="font-bold text-base text-foreground">
                      {debt
                        ? isOwe
                          ? `Lịch trả nợ: ${debt.person}`
                          : `Lịch thu nợ: ${debt.person}`
                        : "Tính lãi & Lịch trả nợ"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {debt
                        ? isOwe
                          ? `Kế hoạch thanh toán cho chủ nợ ${debt.person}`
                          : `Kế hoạch thu hồi nợ từ người vay ${debt.person}`
                        : "Mô phỏng khoản vay theo kỳ hạn và lãi suất"}
                    </p>
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

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {/* Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/70 dark:bg-slate-900/40 p-4 rounded-xl border border-border">
                  {/* Principal */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign size={11} /> {isDebtMode ? "Số tiền nợ gốc (₫)" : "Số tiền (₫)"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      value={principal}
                      onChange={(e) => setPrincipal(e.target.value)}
                      className="w-full bg-background rounded-lg px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-orange-500"
                      placeholder="VD: 10000000"
                    />
                    {principalNum > 0 && (
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(principalNum)}</p>
                    )}
                  </div>

                  {/* Rate */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Percent size={11} /> Lãi suất
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={200}
                        step={0.1}
                        value={annualRate}
                        onChange={(e) => setAnnualRate(e.target.value)}
                        className="w-full bg-background rounded-lg px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-orange-500"
                        placeholder="VD: 12"
                      />
                      <select
                        value={rateType}
                        onChange={(e) => setRateType(e.target.value as any)}
                        className="bg-background rounded-lg px-2.5 py-2 text-xs border border-slate-200 dark:border-slate-800 focus:outline-none"
                      >
                        <option value="year">%/năm</option>
                        <option value="month">%/tháng</option>
                      </select>
                    </div>
                  </div>

                  {/* Months */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={11} /> Kỳ hạn (tháng)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={360}
                      step={1}
                      value={months}
                      onChange={(e) => setMonths(e.target.value)}
                      className="w-full bg-background rounded-lg px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-orange-500"
                      placeholder="VD: 12"
                    />
                  </div>

                  {/* Repayment type */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingDown size={11} /> Phương thức
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setType("annuity")}
                        className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          type === "annuity"
                            ? "border-violet-400 bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 ring-1 ring-violet-300"
                            : "border-border hover:bg-slate-50 dark:hover:bg-slate-800 text-muted-foreground"
                        }`}
                      >
                        Góp đều (EMI)
                      </button>
                      <button
                        type="button"
                        onClick={() => setType("linear")}
                        className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          type === "linear"
                            ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-emerald-300"
                            : "border-border hover:bg-slate-50 dark:hover:bg-slate-800 text-muted-foreground"
                        }`}
                      >
                        Dư nợ giảm
                      </button>
                    </div>
                  </div>
                </div>

                {/* Summary cards */}
                {principalNum > 0 && rows.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="rounded-xl bg-violet-50/80 dark:bg-violet-950/30 border border-violet-200/60 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {isOwe ? "Cần trả/tháng" : "Thu về/tháng"}
                        </p>
                        <p className="text-sm font-black text-violet-700 dark:text-violet-400 mt-1">
                          {formatCurrencyCompact(monthlyPayment)}
                        </p>
                        {type === "linear" && <p className="text-[9px] text-muted-foreground">(tháng đầu)</p>}
                      </div>
                      <div className="rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lãi tháng đầu</p>
                        <p className="text-sm font-black text-rose-700 dark:text-rose-400 mt-1">
                          {formatCurrencyCompact(firstInterest)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tổng tiền lãi</p>
                        <p className="text-sm font-black text-amber-700 dark:text-amber-400 mt-1">
                          {formatCurrencyCompact(totalInterest)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tổng thanh toán</p>
                        <p className="text-sm font-black text-foreground mt-1">
                          {formatCurrencyCompact(totalPayment)}
                        </p>
                      </div>
                    </div>

                    {/* Progress tracking if in debt mode */}
                    {isDebtMode && paidNum > 0 && (
                      <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>
                            Đã thanh toán: <strong>{formatCurrency(paidNum)}</strong> (đạt ~{paidRowsCount}/{monthsNum} kỳ)
                          </span>
                        </div>
                        <span className="font-bold text-emerald-700">
                          Còn lại: {formatCurrency(Math.max(0, principalNum - paidNum))}
                        </span>
                      </div>
                    )}

                    {/* Amortization table toggle */}
                    <button
                      type="button"
                      onClick={() => setShowTable((p) => !p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-semibold cursor-pointer"
                    >
                      <span className="text-foreground">
                        📅 Lịch trả nợ chi tiết ({monthsNum} kỳ)
                      </span>
                      {showTable ? (
                        <ChevronUp size={14} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={14} className="text-muted-foreground" />
                      )}
                    </button>

                    {showTable && (
                      <div className="overflow-auto max-h-64 rounded-xl border border-border">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-border sticky top-0">
                              <th className="px-3 py-2 text-left font-bold text-muted-foreground">Kỳ</th>
                              <th className="px-3 py-2 text-right font-bold text-muted-foreground">Tiền gốc</th>
                              <th className="px-3 py-2 text-right font-bold text-rose-600">Lãi</th>
                              <th className="px-3 py-2 text-right font-bold text-violet-700 dark:text-violet-400">Số tiền trả</th>
                              <th className="px-3 py-2 text-right font-bold text-muted-foreground">Dư nợ còn</th>
                              {isDebtMode && <th className="px-2 py-2 text-center font-bold text-muted-foreground">TT</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr
                                key={row.month}
                                className={`${
                                  row.isPaid
                                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200"
                                    : i % 2 === 0
                                    ? "bg-card"
                                    : "bg-slate-50/60 dark:bg-slate-900/30"
                                }`}
                              >
                                <td className="px-3 py-1.5 font-semibold">
                                  {row.periodLabel}
                                </td>
                                <td className="px-3 py-1.5 text-right font-medium">
                                  {formatCurrencyCompact(row.principal)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-medium text-rose-600">
                                  {formatCurrencyCompact(row.interest)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-bold text-violet-700 dark:text-violet-400">
                                  {formatCurrencyCompact(row.payment)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-medium text-muted-foreground">
                                  {formatCurrencyCompact(row.balance)}
                                </td>
                                {isDebtMode && (
                                  <td className="px-2 py-1.5 text-center">
                                    {row.isPaid ? (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                        ✓ Xong
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">Chờ</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
