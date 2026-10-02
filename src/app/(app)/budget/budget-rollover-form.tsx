"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, RefreshCw, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { rolloverBudgets } from "@/actions/budgets";

const MONTH_NAMES = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
  "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
  "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

interface BudgetRolloverFormProps {
  currentMonth: number;
  currentYear: number;
}

export function BudgetRolloverForm({ currentMonth, currentYear }: BudgetRolloverFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"rollover" | "copy">("rollover");

  // Defaults: from = currentMonth, to = nextMonth
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [fromYear, setFromYear] = useState(currentYear);
  const [toMonth, setToMonth] = useState(nextMonth);
  const [toYear, setToYear] = useState(nextYear);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("fromMonth", String(fromMonth));
      fd.set("fromYear", String(fromYear));
      fd.set("toMonth", String(toMonth));
      fd.set("toYear", String(toYear));
      fd.set("mode", mode);
      const result = await rolloverBudgets(fd);
      if ("error" in result && result.error) {
        toast.error(result.error as string);
      } else if (result.success) {
        toast.success(
          `Hoàn tất! Đã ${mode === "rollover" ? "chuyển số dư" : "sao chép"} ${result.total} ngân sách sang tháng ${toMonth}/${toYear}.`
        );
        setOpen(false);
      }
    } catch {
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <RefreshCw size={15} className="text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-foreground">Chuyển số dư sang tháng sau</p>
            <p className="text-xs text-muted-foreground">Kết chuyển hạn mức chưa sử dụng hoặc sao chép ngân sách</p>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 pt-2 border-t border-border/60 space-y-4">
          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("rollover")}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                mode === "rollover"
                  ? "border-blue-300 bg-blue-50/80 ring-1 ring-blue-300"
                  : "border-border hover:bg-slate-50/80"
              }`}
            >
              <RefreshCw size={14} className={mode === "rollover" ? "text-blue-600 shrink-0 mt-0.5" : "text-muted-foreground shrink-0 mt-0.5"} />
              <div>
                <p className={`text-xs font-bold ${mode === "rollover" ? "text-blue-900" : "text-foreground"}`}>
                  Kết chuyển số dư
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  Cộng phần chưa tiêu vào hạn mức tháng sau
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("copy")}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                mode === "copy"
                  ? "border-violet-300 bg-violet-50/80 ring-1 ring-violet-300"
                  : "border-border hover:bg-slate-50/80"
              }`}
            >
              <Copy size={14} className={mode === "copy" ? "text-violet-600 shrink-0 mt-0.5" : "text-muted-foreground shrink-0 mt-0.5"} />
              <div>
                <p className={`text-xs font-bold ${mode === "copy" ? "text-violet-900" : "text-foreground"}`}>
                  Sao chép ngân sách
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  Giữ nguyên hạn mức, không cộng thêm
                </p>
              </div>
            </button>
          </div>

          {/* From / To selectors */}
          <div className="flex items-center gap-2">
            {/* From */}
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Từ tháng</label>
              <div className="flex gap-1.5">
                <select
                  value={fromMonth}
                  onChange={(e) => setFromMonth(Number(e.target.value))}
                  className="form-input flex-1 text-xs py-2"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={fromYear}
                  onChange={(e) => setFromYear(Number(e.target.value))}
                  className="form-input w-20 text-xs py-2"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-6">
              <ArrowRight size={18} className="text-muted-foreground" />
            </div>

            {/* To */}
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sang tháng</label>
              <div className="flex gap-1.5">
                <select
                  value={toMonth}
                  onChange={(e) => setToMonth(Number(e.target.value))}
                  className="form-input flex-1 text-xs py-2"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={toYear}
                  onChange={(e) => setToYear(Number(e.target.value))}
                  className="form-input w-20 text-xs py-2"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className={`text-xs rounded-xl px-3.5 py-2.5 border ${mode === "rollover" ? "bg-blue-50/60 border-blue-200/60 text-blue-800" : "bg-violet-50/60 border-violet-200/60 text-violet-800"}`}>
            {mode === "rollover" ? (
              <p>
                ✅ Tất cả ngân sách tháng <strong>{fromMonth}/{fromYear}</strong> sẽ được chuyển sang tháng{" "}
                <strong>{toMonth}/{toYear}</strong>. Phần chưa tiêu sẽ được <strong>cộng thêm</strong> vào hạn mức mới.
              </p>
            ) : (
              <p>
                📋 Tất cả ngân sách tháng <strong>{fromMonth}/{fromYear}</strong> sẽ được sao chép y chang sang tháng{" "}
                <strong>{toMonth}/{toYear}</strong>.
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 ${
              mode === "rollover"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-violet-600 hover:bg-violet-700"
            }`}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Đang xử lý...
              </>
            ) : mode === "rollover" ? (
              <>
                <RefreshCw size={14} />
                Kết chuyển số dư
              </>
            ) : (
              <>
                <Copy size={14} />
                Sao chép ngân sách
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
