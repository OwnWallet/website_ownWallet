"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CategoryPieChart } from "@/components/ui/CategoryPieChart";
import { MonthComparisonChart } from "@/components/ui/MonthComparisonChart";
import { formatCurrency, formatMetric } from "@/lib/utils";
import { pctChange } from "@/lib/finance";
import {
  exportTransactionsCSV,
  generateAiFinancialReport,
  type AiFinancialAdvice,
} from "@/actions/reports";
import {
  Download,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  BarChart3,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

interface CategorySpend {
  name: string;
  value: number;
  color: string;
  icon?: string | null;
}

interface MonthItem {
  month: string;
  income: number;
  expense: number;
}

interface Props {
  currentMonthName: string;
  currentMonthIncome: number;
  currentMonthExpense: number;
  lastMonthIncome: number;
  lastMonthExpense: number;
  openingCumulativeBalance: number;
  closingCumulativeBalance: number;
  categorySpending: CategorySpend[];
  monthlyTrend: MonthItem[];
  currentMonth: number | "ALL";
  currentYear: number;
  isYearly?: boolean;
}

export function ReportClient({
  currentMonthName,
  currentMonthIncome,
  currentMonthExpense,
  lastMonthIncome,
  lastMonthExpense,
  openingCumulativeBalance,
  closingCumulativeBalance,
  categorySpending,
  monthlyTrend,
  currentMonth: _currentMonth,
  currentYear,
  isYearly = false,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<AiFinancialAdvice | null>(null);

  const netCurrent = currentMonthIncome - currentMonthExpense;
  const netLast = lastMonthIncome - lastMonthExpense;

  const prevMonthNum =
    !isYearly && typeof _currentMonth === "number"
      ? _currentMonth === 1
        ? 12
        : _currentMonth - 1
      : 12;
  const prevShortLabel = isYearly ? `Năm ${currentYear - 1}` : `T${prevMonthNum}`;
  const currShortLabel = isYearly ? `Năm ${currentYear}` : `T${_currentMonth}`;

  // Keep the change as a number; format only when rendering (formatMetric returns
  // a vi-VN string like "12,5", and Number("12,5") is NaN).
  const incomeChange = pctChange(currentMonthIncome, lastMonthIncome);
  const expenseChange = pctChange(currentMonthExpense, lastMonthExpense);

  const comparePeriodLabel = isYearly ? "năm trước" : "tháng trước";

  async function handleExportCSV() {
    try {
      setDownloading(true);
      const res = await exportTransactionsCSV();
      if (res?.success && res.csv) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Đã xuất báo cáo CSV thành công!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể xuất file CSV");
    } finally {
      setDownloading(false);
    }
  }

  async function handleAnalyzeAI() {
    try {
      setAnalyzingAi(true);
      const res = await generateAiFinancialReport({
        periodName: currentMonthName,
        currentIncome: currentMonthIncome,
        currentExpense: currentMonthExpense,
        lastIncome: lastMonthIncome,
        lastExpense: lastMonthExpense,
        closingBalance: closingCumulativeBalance,
        topCategories: categorySpending.slice(0, 5).map((c) => ({
          name: c.name,
          value: c.value,
        })),
      });
      if (res?.success && res.advice) {
        setAiAdvice(res.advice);
        toast.success("Đã hoàn tất phân tích báo cáo tài chính!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể phân tích báo cáo lúc này.");
    } finally {
      setAnalyzingAi(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="page-header-title">Báo cáo & Phân tích</h1>
            <p className="page-header-subtitle">
              Tổng quan dòng tiền, tỷ trọng chi tiêu và so sánh chu kỳ tài chính
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleAnalyzeAI}
            disabled={analyzingAi}
            className="btn-secondary py-2 px-4 text-xs inline-flex items-center gap-2 border-indigo-500/30 text-indigo-700 hover:bg-indigo-500/10"
          >
            {analyzingAi ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} className="text-indigo-600" />
            )}
            <span>{analyzingAi ? "AI đang phân tích..." : "Cố vấn AI phân tích"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={downloading}
            className="btn-primary py-2 px-4 text-xs inline-flex items-center gap-2"
          >
            {downloading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            <span>{downloading ? "Đang xuất CSV..." : "Xuất báo cáo CSV"}</span>
          </button>
        </div>
      </div>

      {/* Trợ lý AI Phân tích Tài chính (Gemini Financial Coach) */}
      {aiAdvice && (
        <div className="card p-5 border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>Nhận định từ Cố vấn Tài chính AI ({currentMonthName})</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700">
                    {aiAdvice.source === "gemini" ? "Gemini AI" : "Smart CFP Engine"}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{aiAdvice.summary}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiAdvice(null)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md"
            >
              Ẩn
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Điểm sáng */}
            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>Điểm sáng tài chính</span>
              </p>
              {aiAdvice.highlights.length === 0 ? (
                <p className="text-muted-foreground">Đang theo dõi thêm dữ liệu kỳ này.</p>
              ) : (
                <ul className="space-y-1.5 text-foreground/90">
                  {aiAdvice.highlights.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">• {item}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Cảnh báo */}
            <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
              <p className="font-bold text-rose-700 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>Điểm cần lưu ý</span>
              </p>
              {aiAdvice.warnings.length === 0 ? (
                <p className="text-emerald-700 font-medium">
                  Không phát hiện rủi ro thâm hụt hay vượt chi bất thường trong kỳ này.
                </p>
              ) : (
                <ul className="space-y-1.5 text-foreground/90">
                  {aiAdvice.warnings.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">• {item}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Khuyến nghị hành động */}
            <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <p className="font-bold text-amber-800 flex items-center gap-1.5">
                <Lightbulb size={14} />
                <span>Khuyến nghị hành động</span>
              </p>
              <ul className="space-y-1.5 text-foreground/90">
                {aiAdvice.actionableTips.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}


      {/* MoM / YoY Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        {/* Income Card */}
        <div className="card p-5 border-emerald-500/20 bg-emerald-500/5 space-y-2">
          <div className="flex justify-between items-center text-xs text-muted">
            <span className="font-semibold text-emerald-700">Thu nhập ({currentMonthName})</span>
            <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-600">
              <TrendingUp size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(currentMonthIncome)}</p>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
            {incomeChange !== null ? (
              <span
                className={`font-semibold ${
                  incomeChange >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {incomeChange >= 0 ? "+" : ""}
                {formatMetric(incomeChange)}%
              </span>
            ) : (
              <span className="text-muted-foreground">N/A</span>
            )}
            <span>so với {comparePeriodLabel} ({formatCurrency(lastMonthIncome)})</span>
          </div>
        </div>

        {/* Expense Card */}
        <div className="card p-5 border-rose-500/20 bg-rose-500/5 space-y-2">
          <div className="flex justify-between items-center text-xs text-muted">
            <span className="font-semibold text-rose-700">Chi tiêu ({currentMonthName})</span>
            <span className="p-1 rounded-md bg-rose-500/20 text-rose-600">
              <TrendingDown size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-600">{formatCurrency(currentMonthExpense)}</p>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
            {expenseChange !== null ? (
              <span
                className={`font-semibold ${
                  expenseChange <= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {expenseChange > 0 ? "+" : ""}
                {formatMetric(expenseChange)}%
              </span>
            ) : (
              <span className="text-muted-foreground">N/A</span>
            )}
            <span>so với {comparePeriodLabel} ({formatCurrency(lastMonthExpense)})</span>
          </div>
        </div>

        {/* Cumulative Closing Balance Card */}
        <div className="card p-5 border-border-strong bg-elevated/40 space-y-2">
          <div className="flex justify-between items-center text-xs text-muted">
            <span className="font-semibold text-foreground">Số dư lũy kế ({currShortLabel})</span>
            <span className="p-1 rounded-md bg-elevated text-primary">
              <BarChart3 size={14} />
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              closingCumulativeBalance >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {closingCumulativeBalance > 0 ? "+" : ""}
            {formatCurrency(closingCumulativeBalance)}
          </p>
          <div className="text-xs text-muted-foreground pt-1 flex flex-wrap items-center gap-x-2">
            <span>
              Đầu kỳ (hết {prevShortLabel}):{" "}
              <strong className={openingCumulativeBalance >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {openingCumulativeBalance > 0 ? "+" : ""}{formatCurrency(openingCumulativeBalance)}
              </strong>
            </span>
            <span>·</span>
            <span>
              {currShortLabel}:{" "}
              <strong className={netCurrent >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {netCurrent > 0 ? "+" : ""}{formatCurrency(netCurrent)}
              </strong>
            </span>
          </div>
          <p className="text-[11px] text-amber-800/90 font-semibold">
            Riêng biến động {prevShortLabel}: {netLast > 0 ? "+" : ""}{formatCurrency(netLast)}
          </p>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown (Pie) */}
        <div className="lg:col-span-5 card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <PieIcon size={16} className="text-primary" />
                Cơ cấu chi tiêu theo danh mục
              </h2>
              <p className="text-xs text-muted mt-0.5">{currentMonthName}</p>
            </div>
          </div>

          <CategoryPieChart data={categorySpending} />

          {/* Category Legends / Breakdown Table */}
          {categorySpending.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border max-h-48 overflow-y-auto pr-1">
              {categorySpending.map((cat) => (
                <div key={cat.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-foreground font-medium">
                      {cat.icon} {cat.name}
                    </span>
                  </div>
                  <span className="font-bold text-foreground">
                    {formatCurrency(cat.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Trend Comparison (Bar) */}
        <div className="lg:col-span-7 card p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" />
              {isYearly
                ? `So sánh Thu / Chi 12 tháng năm ${currentYear}`
                : "So sánh Thu / Chi các kỳ gần đây"}
            </h2>
            <p className="text-xs text-muted mt-0.5">Biểu đồ đối chiếu thu nhập & chi tiêu</p>
          </div>

          <MonthComparisonChart data={monthlyTrend} />
        </div>
      </div>
    </div>
  );
}
