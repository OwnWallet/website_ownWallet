import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getWallets } from "@/actions/wallets";
import { formatCurrency, formatCurrencyCompact, formatDateTime, calcPercent, formatMetric, getFilterDateRange, toInstant, toDate, serializeData, maskAccountNumber } from "@/lib/utils";
import { BUDGET_WARNING_THRESHOLD } from "@/lib/constants";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import Link from "next/link";
import { DashboardChart } from "@/components/ui/DashboardChart";
import { Card } from "@/components/ui/card";
import { SpendingPieChart } from "@/components/dashboard/SpendingPieChart";
import { CashFlowTrendChart } from "@/components/dashboard/CashFlowTrendChart";
import { FinancialHealthScore } from "@/components/dashboard/FinancialHealthScore";

async function getDashboardData(
  userId: string,
  from: Date,
  to: Date,
  month: number | "ALL",
  year: number,
  walletId?: string
) {
  const fromInstant = toInstant(from);
  const toInstantVal = toInstant(to);

  try {
    let budgetQuery = db.orm.public.Budget
      .where((b) => b.userId.eq(userId))
      .where((b) => b.year.eq(year));

    if (month !== "ALL") {
      budgetQuery = budgetQuery.where((b) => b.month.eq(month));
    }

    let txQuery = db.orm.public.Transaction
      .where((t) => t.userId.eq(userId))
      .where((t) => t.recordedAt.gte(fromInstant))
      .where((t) => t.recordedAt.lte(toInstantVal));

    let recentTxQuery = db.orm.public.Transaction
      .where((t) => t.userId.eq(userId))
      .where((t) => t.recordedAt.gte(fromInstant))
      .where((t) => t.recordedAt.lte(toInstantVal));

    if (walletId && walletId !== "ALL") {
      if (walletId === "UNASSIGNED") {
        txQuery = txQuery.where({ walletId: null });
        recentTxQuery = recentTxQuery.where({ walletId: null });
      } else {
        txQuery = txQuery.where({ walletId });
        recentTxQuery = recentTxQuery.where({ walletId });
      }
    }

    // 6-month historical data for cash flow trend
    const sixMonthsAgo = new Date(from);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const sixMonthsAgoInstant = toInstant(sixMonthsAgo);

    const [monthTransactions, investments, debts, allDebts, budgets, goals, recentTx, realWallets, historicalTx, categoryData] = await Promise.all([
      txQuery
        .orderBy((t) => t.recordedAt.asc())
        .all(),
      db.orm.public.Investment
        .where((t) => t.userId.eq(userId))
        .all(),
      db.orm.public.Debt
        .where((t) => t.userId.eq(userId))
        .where((t) => t.status.neq("PAID"))
        .orderBy((t) => t.dueDate.asc())
        .limit(5)
        .all(),
      // All active debts for health score
      db.orm.public.Debt
        .where((t) => t.userId.eq(userId))
        .where((t) => t.status.neq("PAID"))
        .all(),
      budgetQuery
        .include("category", (cat) => cat)
        .all(),
      db.orm.public.Goal
        .where((t) => t.userId.eq(userId))
        .orderBy((t) => t.deadline.asc())
        .limit(4)
        .all(),
      recentTxQuery
        .include("category", (cat) => cat)
        .include("wallet", (w) => w)
        .orderBy((t) => t.recordedAt.desc())
        .limit(8)
        .all(),
      getWallets(),
      // 6-month historical transactions for trend chart
      db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .where((t) => t.recordedAt.gte(sixMonthsAgoInstant))
        .where((t) => t.recordedAt.lte(toInstantVal))
        .orderBy((t) => t.recordedAt.asc())
        .all(),
      // Transactions with category for spending pie
      txQuery
        .include("category", (cat) => cat)
        .all(),
    ]);

    let income = 0;
    let expense = 0;
    const spentMap = new Map<string, number>();

    monthTransactions.forEach((t: any) => {
      const amt = Number(t.amount);
      if (t.type === "INCOME") {
        income += amt;
      } else if (t.type === "EXPENSE") {
        expense += amt;
        spentMap.set(t.categoryId, (spentMap.get(t.categoryId) || 0) + amt);
      }
    });

    const investPnL = investments.reduce((sum: number, inv: any) => {
      if (inv.currentPrice) {
        return sum + (Number(inv.currentPrice) - Number(inv.buyPrice)) * Number(inv.quantity);
      }
      return sum;
    }, 0);

    const totalInvestmentValue = investments.reduce((sum: number, inv: any) => {
      const price = inv.currentPrice ?? inv.buyPrice;
      return sum + Number(price) * Number(inv.quantity);
    }, 0);

    const budgetsWithSpend = budgets.map((b: any) => ({
      ...b,
      limitAmount: Number(b.limitAmount),
      spent: spentMap.get(b.categoryId) ?? 0,
    }));

    // Spending by category for pie chart
    const categorySpendMap = new Map<string, { name: string; color: string; icon: string; value: number }>();
    for (const tx of categoryData as any[]) {
      if (tx.type !== "EXPENSE") continue;
      const cat = tx.category;
      const key = cat?.id ?? "__none__";
      const existing = categorySpendMap.get(key);
      if (existing) {
        existing.value += Number(tx.amount);
      } else {
        categorySpendMap.set(key, {
          name: cat?.name ?? "Khác",
          color: cat?.color ?? "#64748b",
          icon: cat?.icon ?? "📦",
          value: Number(tx.amount),
        });
      }
    }
    const spendingByCategory = Array.from(categorySpendMap.values())
      .sort((a, b) => b.value - a.value);

    // 6-month trend
    const monthlyMap = new Map<string, { month: string; income: number; expense: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(from);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
      monthlyMap.set(key, { month: label, income: 0, expense: 0 });
    }
    for (const tx of historicalTx as any[]) {
      const d = toDate(tx.recordedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key);
      if (!entry) continue;
      const amt = Number(tx.amount);
      if (tx.type === "INCOME") entry.income += amt;
      else if (tx.type === "EXPENSE") entry.expense += amt;
    }
    const cashFlowTrend = Array.from(monthlyMap.values());

    // Total outstanding debt
    const totalOutstandingDebt = (allDebts as any[]).reduce((sum, d) => {
      return sum + Math.max(0, Number(d.amount) - Number(d.paidAmount));
    }, 0);

    // Total wallet balance
    const totalWalletBalance = (realWallets as any[]).reduce((sum, w) => {
      return sum + (Number(w.currentBalance ?? w.balance ?? 0));
    }, 0);

    // Budget health for score
    const budgetHealth = budgetsWithSpend.map((b: any) => ({
      spent: b.spent,
      limitAmount: b.limitAmount,
    }));

    const plainMonthTransactions = monthTransactions.map((t: any) => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      recordedAt: toDate(t.recordedAt).toISOString(),
    }));

    const plainRecentTx = recentTx.map((t: any) => ({
      ...t,
      amount: Number(t.amount),
      recordedAt: toDate(t.recordedAt).toISOString(),
      createdAt: toDate(t.createdAt).toISOString(),
    }));

    const plainDebts = debts.map((d: any) => ({
      ...d,
      amount: Number(d.amount),
      paidAmount: Number(d.paidAmount),
      dueDate: d.dueDate ? toDate(d.dueDate).toISOString() : null,
      createdAt: toDate(d.createdAt).toISOString(),
    }));

    const plainGoals = goals.map((g: any) => ({
      ...g,
      targetAmount: Number(g.targetAmount),
      savedAmount: Number(g.savedAmount),
      deadline: g.deadline ? toDate(g.deadline).toISOString() : null,
      createdAt: toDate(g.createdAt).toISOString(),
    }));

    const wallets = realWallets;

    return {
      income,
      expense,
      investPnL,
      debts: serializeData(plainDebts),
      budgetsWithSpend: serializeData(budgetsWithSpend),
      goals: serializeData(plainGoals),
      recentTx: serializeData(plainRecentTx),
      monthTransactions: serializeData(plainMonthTransactions),
      wallets,
      spendingByCategory,
      cashFlowTrend,
      totalOutstandingDebt,
      totalWalletBalance,
      totalInvestmentValue,
      budgetHealth,
    };
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    return {
      income: 0,
      expense: 0,
      investPnL: 0,
      debts: [],
      budgetsWithSpend: [],
      goals: [],
      recentTx: [],
      monthTransactions: [],
      wallets: [],
      spendingByCategory: [],
      cashFlowTrend: [],
      totalOutstandingDebt: 0,
      totalWalletBalance: 0,
      totalInvestmentValue: 0,
      budgetHealth: [],
    };
  }
}

interface DashboardPageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
    wallet?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const resolvedSearchParams = (await searchParams) || {};
  const filterDate = getFilterDateRange(resolvedSearchParams.month, resolvedSearchParams.year);
  const cookieStore = await cookies();
  const savedCookieWallet = cookieStore.get("ownwallet_selected_wallet")?.value;
  const selectedWalletId = resolvedSearchParams.wallet || savedCookieWallet || "ALL";

  const {
    income,
    expense,
    investPnL,
    debts,
    budgetsWithSpend,
    goals,
    recentTx,
    monthTransactions,
    wallets,
    spendingByCategory,
    cashFlowTrend,
    totalOutstandingDebt,
    totalWalletBalance,
    totalInvestmentValue,
    budgetHealth,
  } = await getDashboardData(
    session.user.id,
    filterDate.from,
    filterDate.to,
    filterDate.month,
    filterDate.year,
    selectedWalletId
  );
  const netBalance = income - expense;

  const monthLabel = filterDate.label;

  const activeWallet =
    selectedWalletId === "ALL"
      ? null
      : selectedWalletId === "UNASSIGNED"
      ? { id: "UNASSIGNED", name: "Chưa gán tài khoản", accountNumber: "" }
      : wallets.find((w: any) => w.id === selectedWalletId) || null;

  const kpiCards = [
    {
      label: "Thu nhập",
      value: income,
      color: "text-emerald-700",
      iconColor: "text-emerald-600",
      bgIcon: "bg-emerald-100/80",
      bgCard: "bg-emerald-50/60 border-emerald-200/80",
      icon: TrendingUp,
      prefix: "+",
      desc: filterDate.label,
    },
    {
      label: "Chi tiêu",
      value: expense,
      color: "text-rose-700",
      iconColor: "text-rose-600",
      bgIcon: "bg-rose-100/80",
      bgCard: "bg-rose-50/60 border-rose-200/80",
      icon: TrendingDown,
      prefix: "",
      desc: filterDate.label,
    },
    {
      label: "Số dư ròng",
      value: netBalance,
      color: netBalance >= 0 ? "text-amber-700" : "text-rose-700",
      iconColor: netBalance >= 0 ? "text-amber-600" : "text-rose-600",
      bgIcon: netBalance >= 0 ? "bg-amber-100/80" : "bg-rose-100/80",
      bgCard: netBalance >= 0 ? "bg-amber-50/60 border-amber-200/80" : "bg-rose-50/60 border-rose-200/80",
      icon: Wallet,
      prefix: netBalance >= 0 ? "+" : "",
      desc: "Thu - Chi",
    },
    {
      label: "Lợi nhuận ĐT",
      value: investPnL,
      color: investPnL >= 0 ? "text-blue-700" : "text-rose-700",
      iconColor: investPnL >= 0 ? "text-blue-600" : "text-rose-600",
      bgIcon: investPnL >= 0 ? "bg-blue-100/80" : "bg-rose-100/80",
      bgCard: investPnL >= 0 ? "bg-blue-50/60 border-blue-200/80" : "bg-rose-50/60 border-rose-200/80",
      icon: ArrowUpRight,
      prefix: investPnL >= 0 ? "+" : "",
      desc: "Tổng danh mục",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-sm">
            <TrendingUp size={20} />
          </div>
          <div>
            <h1 className="page-header-title">Tổng quan tài chính</h1>
            <p className="page-header-subtitle">{monthLabel}</p>
          </div>
        </div>
        <Link href="/transactions/new" className="btn-primary">
          <Plus size={16} />
          Thêm giao dịch
        </Link>
      </div>

      {/* Active Account Filter Badge */}
      {activeWallet && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-orange-50/80 border border-orange-200/70 animate-scale-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center shrink-0 text-xs font-bold">
              {activeWallet.bankName === "CASH" || (activeWallet.name || "").toLowerCase().includes("tiền mặt") ? "💵" : "💳"}
            </div>
            <p className="text-xs font-semibold text-orange-900 truncate">
              Đang lọc:{" "}
              <span className="font-bold text-orange-700">{activeWallet.name}</span>
              {activeWallet.accountNumber && activeWallet.bankName !== "CASH" && (
                <span className="text-muted-foreground font-normal ml-1">(STK: {maskAccountNumber(activeWallet.accountNumber)})</span>
              )}
            </p>
          </div>
          <Link
            href={`/dashboard?${(() => {
              const p = new URLSearchParams();
              if (resolvedSearchParams.month) p.set("month", resolvedSearchParams.month);
              if (resolvedSearchParams.year) p.set("year", resolvedSearchParams.year);
              return p.toString();
            })()}`}
            className="text-xs font-semibold text-orange-700 hover:text-orange-900 bg-white px-2.5 py-1 rounded-lg border border-orange-200/90 shrink-0 shadow-2xs hover:bg-orange-50/50 transition-colors"
          >
            Xem tất cả
          </Link>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <div
            key={card.label}
            className={`rounded-2xl p-5 border shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-in ${card.bgCard}`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Icon & Label */}
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${card.bgIcon} flex items-center justify-center ${card.iconColor} shadow-2xs`}>
                <card.icon size={20} />
              </div>
              <span className={`text-xs font-black uppercase tracking-wider ${card.color}`}>
                {card.label}
              </span>
            </div>

            {/* Value */}
            <div className="space-y-1">
              <p className={`text-3xl font-black tracking-tight ${card.color}`}>
                {card.prefix}{formatCurrencyCompact(Math.abs(card.value))}
              </p>
              <p className="text-xs text-slate-700 font-semibold">
                {formatCurrency(Math.abs(card.value))}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Daily cash flow chart */}
      <Card className="p-5 border-border bg-card shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold text-foreground">Biểu đồ Thu / Chi theo ngày</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Thu nhập</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Chi tiêu</span>
            </div>
          </div>
        </div>
        <DashboardChart transactions={monthTransactions} />
      </Card>

      {/* Financial Health + Spending Breakdown (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Health Score */}
        <Card className="p-5 border-border bg-card shadow-xs">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
            <div>
              <h2 className="text-base font-bold text-foreground">🏥 Sức khỏe Tài chính</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Chỉ số tổng thể tháng này</p>
            </div>
            <Link href="/income" className="text-xs font-semibold text-orange-600 hover:underline">
              Dòng tiền →
            </Link>
          </div>
          <FinancialHealthScore
            income={income}
            expense={expense}
            totalDebt={totalOutstandingDebt}
            totalWalletBalance={totalWalletBalance}
            totalInvestmentValue={totalInvestmentValue}
            budgets={budgetHealth}
          />
        </Card>

        {/* Spending pie + trend */}
        <div className="flex flex-col gap-5">
          {/* Spending pie chart */}
          <Card className="p-5 border-border bg-card shadow-xs flex-1">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground">🎯 Chi tiêu theo danh mục</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{monthLabel}</p>
              </div>
              <Link href="/transactions" className="text-xs font-semibold text-orange-600 hover:underline">
                Xem →
              </Link>
            </div>
            <SpendingPieChart data={spendingByCategory} totalExpense={expense} />
          </Card>
        </div>
      </div>

      {/* Cash flow trend (6 months) */}
      <Card className="p-5 border-border bg-card shadow-xs">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">📈 Xu hướng dòng tiền</h2>
            <p className="text-xs text-muted-foreground mt-0.5">6 tháng gần nhất</p>
          </div>
        </div>
        <CashFlowTrendChart data={cashFlowTrend} />
      </Card>

      {/* 2-col responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-7 xl:col-span-8 card bg-card border-border shadow-xs p-5">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
            <h2 className="text-base font-bold text-foreground">Giao dịch gần nhất</h2>
            <Link href="/transactions" className="text-xs font-semibold text-orange-600 flex items-center gap-1 hover:underline">
              Xem tất cả <ArrowUpRight size={14} />
            </Link>
          </div>

          {recentTx.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-3xl mb-2">💳</div>
              <p className="text-sm font-medium">Chưa có giao dịch nào trong {filterDate.label.toLowerCase()}</p>
              <Link href="/transactions/new" className="text-xs font-semibold text-orange-600 mt-2 inline-block hover:underline">
                + Thêm giao dịch ngay
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTx.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3.5 py-3 hover:bg-slate-50/80 -mx-2 px-2 rounded-lg transition-colors"
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border border-slate-200/80"
                    style={{ backgroundColor: `${tx.category?.color || "#ea580c"}15` }}
                  >
                    {tx.category?.icon ?? "💳"}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {tx.note || tx.description || tx.category?.name || "Giao dịch"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{tx.category?.name}</span>
                      {tx.wallet && (
                        <span className="font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200/60 text-[10px]">
                          {tx.wallet.name}
                        </span>
                      )}
                      <span>·</span>
                      <span>{formatDateTime(tx.recordedAt)}</span>
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center ${
                        tx.type === "INCOME" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {tx.type === "INCOME" ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        tx.type === "INCOME" ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {tx.type === "INCOME" ? "+" : "-"}{formatCurrencyCompact(Number(tx.amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar widgets */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          {/* Wallets & Accounts */}
          <div className="card bg-card border-border shadow-xs p-5">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>💳</span> Tài khoản ({wallets.length})
              </h2>
              <Link href="/wallets" className="text-xs font-semibold text-orange-600 hover:underline">
                Quản lý →
              </Link>
            </div>

            {wallets.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Chưa có tài khoản nào</p>
            ) : (
              <div className="space-y-2.5">
                {wallets.map((w: any) => {
                  const isTpb = (w.bankName || w.name).toLowerCase().includes("tpb");
                  const isTcb = (w.bankName || w.name).toLowerCase().includes("techcombank");
                  const iconBg = isTpb
                    ? "bg-violet-100 text-violet-700"
                    : isTcb
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-700";

                  return (
                    <Link
                      key={w.id}
                      href={`/transactions?wallet=${w.id}`}
                      className={`flex justify-between items-center p-2.5 rounded-xl border transition-all group ${
                        selectedWalletId === w.id
                          ? "bg-orange-50/80 border-orange-300 ring-1 ring-orange-300 shadow-2xs"
                          : "bg-slate-50 hover:bg-slate-100/80 border-slate-200/70"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs font-extrabold text-[11px] ${iconBg}`}>
                          {isTpb ? "TPB" : isTcb ? "TCB" : <Wallet size={14} />}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-foreground truncate block group-hover:text-primary transition-colors">
                            {w.name}
                          </span>
                          {w.accountNumber ? (
                            <span className="text-[10px] text-muted-foreground truncate block">
                              STK: {maskAccountNumber(w.accountNumber)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground truncate block">
                              {w.txCount ?? 0} giao dịch
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-foreground block">
                          {formatCurrencyCompact(w.currentBalance ?? w.balance)}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-medium">
                          {w.txCount ?? 0} GD
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Budget */}
          <div className="card bg-card border-border shadow-xs p-5">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>💼</span> {filterDate.month === "ALL" ? `Ngân sách năm ${filterDate.year}` : `Ngân sách ${filterDate.label.toLowerCase()}`}
              </h2>
              <Link href="/budget" className="text-xs font-semibold text-orange-600 hover:underline">
                Quản lý →
              </Link>
            </div>

            {budgetsWithSpend.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Chưa thiết lập ngân sách</p>
            ) : (
              <div className="space-y-3.5">
                {budgetsWithSpend.slice(0, 4).map((b: any) => {
                  const pct = calcPercent(b.spent, Number(b.limitAmount));
                  const isWarn = pct >= BUDGET_WARNING_THRESHOLD * 100;
                  const barColor = pct >= 100 ? "bg-rose-500" : isWarn ? "bg-amber-500" : "bg-emerald-500";
                  const textColor = pct >= 100 ? "text-rose-700" : isWarn ? "text-amber-700" : "text-emerald-700";

                  return (
                    <div key={b.id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{b.category?.icon ?? "📦"}</span>
                          <span className="font-semibold text-foreground">{b.category?.name}</span>
                          {isWarn && <AlertTriangle size={12} className="text-amber-500" />}
                        </div>
                        <span className={`font-bold ${textColor}`}>{formatMetric(pct)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{formatCurrencyCompact(b.spent)}</span>
                        <span>{formatCurrencyCompact(Number(b.limitAmount))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Goals */}
          <div className="card bg-card border-border shadow-xs p-5">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>🎯</span> Mục tiêu tiết kiệm
              </h2>
              <Link href="/goals" className="text-xs font-semibold text-orange-600 hover:underline">
                Xem →
              </Link>
            </div>

            {goals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Chưa có mục tiêu nào</p>
            ) : (
              <div className="space-y-3">
                {goals.map((g: any) => {
                  const pct = calcPercent(Number(g.savedAmount), Number(g.targetAmount));
                  return (
                    <div key={g.id} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-foreground">{g.name}</span>
                        <span className="font-bold text-purple-700">{formatMetric(pct)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <div
                          className="h-full bg-purple-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Debts */}
          {debts.length > 0 && (
            <div className="card bg-card border-border shadow-xs p-5">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-border">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>🤝</span> Sổ nợ cần chú ý
                </h2>
                <Link href="/debts" className="text-xs font-semibold text-orange-600 hover:underline">
                  Xem →
                </Link>
              </div>

              <div className="space-y-2.5">
                {debts.map((d: any) => {
                  const remaining = Number(d.amount) - Number(d.paidAmount);
                  const isOverdue = d.dueDate && toDate(d.dueDate) < new Date();
                  return (
                    <div key={d.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div>
                        <p className="text-xs font-bold text-foreground">{d.person}</p>
                        <p className={`text-[11px] font-medium ${isOverdue ? "text-rose-600 font-bold" : "text-muted-foreground"}`}>
                          {d.direction === "OWE" ? "Tôi nợ" : "Được nợ"}{isOverdue ? " · Quá hạn" : ""}
                        </p>
                      </div>
                      <span className={`text-xs font-bold ${d.direction === "OWE" ? "text-rose-700" : "text-emerald-700"}`}>
                        {formatCurrencyCompact(remaining)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
