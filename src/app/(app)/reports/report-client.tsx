"use client";

import { useState } from "react";
import { CategoryPieChart } from "@/components/ui/CategoryPieChart";
import { MonthComparisonChart } from "@/components/ui/MonthComparisonChart";
import { formatCurrency } from "@/lib/utils";
import { exportTransactionsCSV } from "@/actions/reports";
import {
  Download,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  BarChart3,
  Loader2,
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
  categorySpending,
  monthlyTrend,
  currentMonth,
  currentYear,
  isYearly = false,
}: Props) {
  const [downloading, setDownloading] = useState(false);

  const netCurrent = currentMonthIncome - currentMonthExpense;
  const netLast = lastMonthIncome - lastMonthExpense;

  const incomeChange =
    lastMonthIncome > 0
      ? (((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100).toFixed(1)
      : null;

  const expenseChange =
    lastMonthExpense > 0
      ? (((currentMonthExpense - lastMonthExpense) / lastMonthExpense) * 100).toFixed(1)
      : null;

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
      }
    } catch (err) {
      console.error(err);
      alert("Không thể xuất file CSV");
    } finally {
      setDownloading(false);
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

        <button
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
                  Number(incomeChange) >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {Number(incomeChange) >= 0 ? "+" : ""}
                {incomeChange}%
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
                  Number(expenseChange) <= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {Number(expenseChange) > 0 ? "+" : ""}
                {expenseChange}%
              </span>
            ) : (
              <span className="text-muted-foreground">N/A</span>
            )}
            <span>so với {comparePeriodLabel} ({formatCurrency(lastMonthExpense)})</span>
          </div>
        </div>

        {/* Net Savings Card */}
        <div className="card p-5 border-border-strong bg-elevated/40 space-y-2">
          <div className="flex justify-between items-center text-xs text-muted">
            <span className="font-semibold text-foreground">Tiết kiệm ròng ({currentMonthName})</span>
            <span className="p-1 rounded-md bg-elevated text-primary">
              <BarChart3 size={14} />
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              netCurrent >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {netCurrent > 0 ? "+" : ""}
            {formatCurrency(netCurrent)}
          </p>
          <div className="text-xs text-muted-foreground pt-1">
            <span>{isYearly ? "Năm trước" : "Tháng trước"}: {formatCurrency(netLast)}</span>
          </div>
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
