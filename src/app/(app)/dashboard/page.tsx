import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, formatCurrencyCompact, formatDateTime, calcPercent, getCurrentMonthRange, toInstant } from "@/lib/utils";
import { BUDGET_WARNING_THRESHOLD } from "@/lib/constants";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardChart } from "@/components/ui/DashboardChart";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Tổng quan — wnWallet" };

async function getDashboardData(userId: string) {
  const { from, to } = getCurrentMonthRange();
  const fromInstant = toInstant(from);
  const toInstantVal = toInstant(to);

  try {
    const [monthTransactions, investments, debts, budgets, goals, recentTx] = await Promise.all([
      db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .where((t) => t.recordedAt.gte(fromInstant))
        .where((t) => t.recordedAt.lte(toInstantVal))
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
      db.orm.public.Budget
        .where((t) => t.userId.eq(userId))
        .where((t) => t.month.eq(from.getMonth() + 1))
        .where((t) => t.year.eq(from.getFullYear()))
        .include("category", (cat) => cat)
        .all(),
      db.orm.public.Goal
        .where((t) => t.userId.eq(userId))
        .orderBy((t) => t.deadline.asc())
        .limit(4)
        .all(),
      db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .include("category", (cat) => cat)
        .orderBy((t) => t.recordedAt.desc())
        .limit(8)
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

    const budgetsWithSpend = budgets.map((b: any) => ({
      ...b,
      limitAmount: Number(b.limitAmount),
      spent: spentMap.get(b.categoryId) ?? 0,
    }));

    const plainMonthTransactions = monthTransactions.map((t: any) => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      recordedAt: t.recordedAt,
    }));

    const plainRecentTx = recentTx.map((t: any) => ({
      ...t,
      amount: Number(t.amount),
    }));

    const plainDebts = debts.map((d: any) => ({
      ...d,
      amount: Number(d.amount),
      paidAmount: Number(d.paidAmount),
    }));

    const plainGoals = goals.map((g: any) => ({
      ...g,
      targetAmount: Number(g.targetAmount),
      savedAmount: Number(g.savedAmount),
    }));

    const wallets = [
      { id: "main-wallet", name: "Ví chính", balance: income - expense },
    ];

    return {
      income,
      expense,
      investPnL,
      debts: plainDebts,
      budgetsWithSpend,
      goals: plainGoals,
      recentTx: plainRecentTx,
      monthTransactions: plainMonthTransactions,
      wallets,
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
    };
  }
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { income, expense, investPnL, debts, budgetsWithSpend, goals, recentTx, monthTransactions, wallets } =
    await getDashboardData(session.user.id);
  const netBalance = income - expense;

  const now = new Date();
  const monthLabel = now.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });

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
      desc: "Tháng này",
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
      desc: "Tháng này",
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-border">
        <div>
          <p className="text-xs text-muted-foreground font-medium capitalize mb-1">{monthLabel}</p>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">Tổng quan tài chính</h1>
        </div>
        <Link href="/transactions/new" className="btn-primary">
          <Plus size={16} />
          Thêm giao dịch
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <div
            key={card.label}
            className={`rounded-xl p-5 border shadow-xs transition-all hover:shadow-md animate-fade-in ${card.bgCard}`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Icon & Label */}
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${card.bgIcon} flex items-center justify-center ${card.iconColor}`}>
                <card.icon size={18} />
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${card.color}`}>
                {card.label}
              </span>
            </div>

            {/* Value */}
            <div className="space-y-1">
              <p className={`text-2xl font-black tracking-tight ${card.color}`}>
                {card.prefix}{formatCurrencyCompact(Math.abs(card.value))}
              </p>
              <p className="text-xs text-slate-600 font-medium">
                {formatCurrency(Math.abs(card.value))}
              </p>
              <p className="text-[11px] text-muted-foreground">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
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
              <p className="text-sm font-medium">Chưa có giao dịch nào trong tháng</p>
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.category?.name} · {formatDateTime(tx.recordedAt)}
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
          {/* Wallets */}
          <div className="card bg-card border-border shadow-xs p-5">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>💳</span> Ví tiền & Dòng tiền
              </h2>
              <Link href="/transactions" className="text-xs font-semibold text-orange-600 hover:underline">
                Chi tiết →
              </Link>
            </div>

            {wallets.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Chưa có ví nào</p>
            ) : (
              <div className="space-y-3">
                {wallets.map((w) => (
                  <div key={w.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                        <Wallet size={14} />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{w.name}</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">{formatCurrencyCompact(Number(w.balance))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Budget */}
          <div className="card bg-card border-border shadow-xs p-5">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>💼</span> Ngân sách tháng
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
                        <span className={`font-bold ${textColor}`}>{pct}%</span>
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
                        <span className="font-bold text-purple-700">{pct}%</span>
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
                  const isOverdue = d.dueDate && new Date(d.dueDate) < new Date();
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
