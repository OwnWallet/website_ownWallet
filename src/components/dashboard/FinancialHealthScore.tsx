"use client";

import { useMemo } from "react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet, Shield } from "lucide-react";

interface FinancialHealthProps {
  income: number;
  expense: number;
  totalDebt: number; // total payable debt (OWE)
  totalReceivable?: number; // total receivable debt (OWED)
  totalWalletBalance: number;
  totalInvestmentValue: number;
  budgets: { spent: number; limitAmount: number }[];
  monthlyExpenseAvg?: number; // last 3-month avg expense for runway calc
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;
  const color =
    score >= 75 ? "#059669" : score >= 50 ? "#2563eb" : score >= 30 ? "#d97706" : "#e11d48";
  const label =
    score >= 75 ? "Xuất sắc" : score >= 50 ? "Tốt" : score >= 30 ? "Cần cải thiện" : "Rủi ro";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          {/* Track */}
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          {/* Progress */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>
            {score}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold">/100</span>
        </div>
      </div>
      <div
        className="text-xs font-bold px-3 py-1 rounded-full"
        style={{ backgroundColor: `${color}18`, color }}
      >
        {label}
      </div>
    </div>
  );
}

interface MetricBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  description: string;
  icon: React.ReactNode;
  invert?: boolean; // higher is worse
}

function MetricBar({ label, value, max, color, description, icon, invert }: MetricBarProps) {
  const clamped = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-semibold text-foreground">{label}</span>
        </div>
        <span className="font-bold" style={{ color }}>
          {value.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
}

export function FinancialHealthScore({
  income,
  expense,
  totalDebt,
  totalReceivable = 0,
  totalWalletBalance,
  totalInvestmentValue,
  budgets,
  monthlyExpenseAvg,
}: FinancialHealthProps) {
  const metrics = useMemo(() => {
    // 1. Savings rate (0–100, higher = better, capped contribution at 40pts)
    const savingsRate = income > 0 ? Math.max(0, ((income - expense) / income) * 100) : 0;
    const savingsScore = Math.min(40, (savingsRate / 30) * 40); // 30% rate = full 40pts

    // 2. Debt-to-income ratio (lower = better, capped contribution at 30pts)
    const dtiRatio = income > 0 ? (totalDebt / income) * 100 : totalDebt > 0 ? 100 : 0;
    const dtiScore = Math.max(0, 30 - (dtiRatio / 100) * 30);

    // 3. Emergency runway (months of expense covered by wallet balance, capped 6 months = 20pts)
    const avgMonthlyExpense = monthlyExpenseAvg ?? expense;
    const runwayMonths = avgMonthlyExpense > 0 ? totalWalletBalance / avgMonthlyExpense : 0;
    const runwayScore = Math.min(20, (runwayMonths / 6) * 20);

    // 4. Budget discipline (% categories within limit, 10pts)
    const onBudget = budgets.filter((b) => b.spent <= b.limitAmount).length;
    const budgetScore = budgets.length > 0 ? (onBudget / budgets.length) * 10 : 10;

    const total = Math.round(savingsScore + dtiScore + runwayScore + budgetScore);

    const dtiColor =
      dtiRatio <= 20 ? "#059669" : dtiRatio <= 50 ? "#2563eb" : dtiRatio <= 80 ? "#d97706" : "#e11d48";
    const savingsColor =
      savingsRate >= 20 ? "#059669" : savingsRate >= 10 ? "#2563eb" : savingsRate >= 5 ? "#d97706" : "#e11d48";
    const runwayColor =
      runwayMonths >= 6 ? "#059669" : runwayMonths >= 3 ? "#2563eb" : runwayMonths >= 1 ? "#d97706" : "#e11d48";

    return {
      total: Math.max(0, Math.min(100, total)),
      savingsRate: Math.round(savingsRate),
      savingsColor,
      dtiRatio: Math.round(dtiRatio),
      dtiColor,
      runwayMonths: Math.round(runwayMonths * 10) / 10,
      runwayColor,
    };
  }, [income, expense, totalDebt, totalWalletBalance, totalInvestmentValue, budgets, monthlyExpenseAvg]);

  const netWorth = totalWalletBalance + totalInvestmentValue + totalReceivable - totalDebt;

  return (
    <div className="space-y-5">
      {/* Score gauge + net worth */}
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="flex flex-col items-center">
          <ScoreGauge score={metrics.total} />
          <p className="text-[10px] text-muted-foreground mt-1 text-center">Chỉ số Sức khỏe Tài chính</p>
        </div>

        <div className="flex-1 grid grid-cols-1 gap-2.5 w-full">
          {/* Net worth card */}
          <div className={`rounded-xl px-3.5 py-2.5 border ${netWorth >= 0 ? "bg-emerald-50/60 border-emerald-200/60" : "bg-rose-50/60 border-rose-200/60"}`}>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Tài sản ròng</p>
            <p className={`text-xl font-black mt-0.5 ${netWorth >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {netWorth >= 0 ? "+" : ""}{formatCurrencyCompact(netWorth)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Ví: {formatCurrencyCompact(totalWalletBalance)} + ĐT: {formatCurrencyCompact(totalInvestmentValue)}
              {totalReceivable > 0 ? ` + Phải thu: ${formatCurrencyCompact(totalReceivable)}` : ""} − Nợ: {formatCurrencyCompact(totalDebt)}
            </p>
          </div>

          {/* Runway */}
          <div className="rounded-xl px-3.5 py-2.5 border bg-slate-50/60 border-slate-200/60">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Dự phòng khẩn cấp</p>
            <p className={`text-xl font-black mt-0.5`} style={{ color: metrics.runwayColor }}>
              {metrics.runwayMonths} tháng
            </p>
            <p className="text-[10px] text-muted-foreground">Số tháng sống được với chi tiêu hiện tại</p>
          </div>
        </div>
      </div>

      {/* Metric bars */}
      <div className="space-y-3 border-t border-border pt-4">
        <MetricBar
          label="Tỷ lệ tiết kiệm"
          value={metrics.savingsRate}
          max={100}
          color={metrics.savingsColor}
          description={`Mục tiêu ≥ 20% · Hiện tại: ${metrics.savingsRate}% thu nhập được tiết kiệm`}
          icon={<TrendingUp size={12} />}
        />
        <MetricBar
          label="Gánh nặng nợ (DTI)"
          value={metrics.dtiRatio}
          max={100}
          color={metrics.dtiColor}
          description={`Mục tiêu < 20% · Nợ bằng ${metrics.dtiRatio}% thu nhập tháng này`}
          icon={<TrendingDown size={12} />}
          invert
        />
      </div>
    </div>
  );
}
