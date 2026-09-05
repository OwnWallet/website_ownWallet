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
}

export function ReportClient({
  currentMonthName,
  currentMonthIncome,
  currentMonthExpense,
  lastMonthIncome,
  lastMonthExpense,
  categorySpending,
  monthlyTrend,
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
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Báo cáo & Phân tích</h1>
          <p className="text-muted text-sm mt-1">
            Tổng quan dòng tiền, tỷ trọng chi tiêu và so sánh chu kỳ tài chính
          </p>
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

      {/* MoM Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income Card */}
        <div className="card p-5 border-income/20 bg-income/5 space-y-2">
          <div className="flex justify-between items-center text-xs text-muted">
            <span className="font-semibold">Thu nhập ({currentMonthName})</span>
            <span className="p-1 rounded-md bg-income/20 text-income">
              <TrendingUp size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-income">{formatCurrency(currentMonthIncome)}</p>
          <div className="text-xs text-muted flex items-center gap-1.5 pt-1">
            {incomeChange !== null ? (
              <span
                className={`font-semibold ${
                  Number(incomeChange) >= 0 ? "text-income" : "text-expense"
                }`}
              >
                {Number(incomeChange) >= 0 ? "+" : ""}
                {incomeChange}%
              </span>
            ) : (
              <span className="text-subtle">N/A</span>
            )}
            <span>so với tháng trước ({formatCurrency(lastMonthIncome)})</span>
          </div>
        </div>

        {/* Expense Card */}
        <div className="card p-5 border-expense/20 bg-expense/5 space-y-2">
          <div className="flex justify-between items-center text-xs text-muted">
            <span className="font-semibold">Chi tiêu ({currentMonthName})</span>
            <span className="p-1 rounded-md bg-expense/20 text-expense">
              <TrendingDown size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-expense">{formatCurrency(currentMonthExpense)}</p>
          <div className="text-xs text-muted flex items-center gap-1.5 pt-1">
            {expenseChange !== null ? (
              <span
                className={`font-semibold ${
                  Number(expenseChange) <= 0 ? "text-income" : "text-expense"
                }`}
              >
                {Number(expenseChange) > 0 ? "+" : ""}
                {expenseChange}%
              </span>
            ) : (
              <span className="text-subtle">N/A</span>
            )}
            <span>so với tháng trước ({formatCurrency(lastMonthExpense)})</span>
          </div>
        </div>

        {/* Net Savings Card */}
        <div className="card p-5 border-border-strong bg-elevated/40 space-y-2">
          <div className="flex justify-between items-center text-xs text-muted">
            <span className="font-semibold">Tiết kiệm ròng ({currentMonthName})</span>
            <span className="p-1 rounded-md bg-elevated text-brand">
              <BarChart3 size={14} />
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              netCurrent >= 0 ? "text-income" : "text-expense"
            }`}
          >
            {netCurrent > 0 ? "+" : ""}
            {formatCurrency(netCurrent)}
          </p>
          <div className="text-xs text-muted pt-1">
            <span>Tháng trước: {formatCurrency(netLast)}</span>
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
              So sánh Thu / Chi các tháng gần đây
            </h2>
            <p className="text-xs text-muted mt-0.5">Biểu đồ đối chiếu thu nhập & chi tiêu</p>
          </div>

          <MonthComparisonChart data={monthlyTrend} />
        </div>
      </div>
    </div>
  );
}
