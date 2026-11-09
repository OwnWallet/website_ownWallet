import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { formatCurrency, calcPercent, formatMetric, getFilterDateRange, serializeData } from "@/lib/utils";
import { getAutoRolloverBudgets, EnrichedBudgetItem } from "@/actions/budgets";
import { BudgetListClient } from "./budget-list-client";
import { PiggyBank, TrendingDown, AlertCircle, Wallet, Sparkles } from "lucide-react";

interface BudgetPageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
    wallet?: string;
  }>;
}

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const resolvedSearchParams = (await searchParams) || {};
  const filterDate = getFilterDateRange(resolvedSearchParams.month, resolvedSearchParams.year);
  const cookieStore = await cookies();
  const savedCookieWallet = cookieStore.get("ownwallet_selected_wallet")?.value;
  const selectedWalletId = resolvedSearchParams.wallet || savedCookieWallet || "ALL";

  let budgets: EnrichedBudgetItem[] = [];
  let expenseCategories: any[] = [];
  let totalBaseLimit = 0;
  let totalRolloverAmount = 0;
  let totalLimit = 0;
  let totalSpent = 0;

  try {
    const [autoBudgetData, cList] = await Promise.all([
      getAutoRolloverBudgets(userId, filterDate.month, filterDate.year, selectedWalletId),
      db.orm.public.Category
        .where((c) => c.userId.eq(userId))
        .where((c) => c.type.eq("EXPENSE"))
        .all(),
    ]);

    budgets = autoBudgetData.budgets;
    totalBaseLimit = autoBudgetData.totalBaseLimit;
    totalRolloverAmount = autoBudgetData.totalRolloverAmount;
    totalLimit = autoBudgetData.totalEffectiveLimit;
    totalSpent = autoBudgetData.totalSpent;
    expenseCategories = serializeData(cList);
  } catch (error) {
    console.error("Failed to fetch budget data:", error);
    return (
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <p className="empty-state-title text-rose-600">Đã có lỗi xảy ra khi tải dữ liệu ngân sách.</p>
      </div>
    );
  }

  const overallPercent = calcPercent(totalSpent, totalLimit);
  const remaining = totalLimit - totalSpent;

  const prevMonthLabel =
    typeof filterDate.month === "number"
      ? `Tháng ${filterDate.month === 1 ? 12 : filterDate.month - 1}/${
          filterDate.month === 1 ? filterDate.year - 1 : filterDate.year
        }`
      : "tháng trước";

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-sm">
            <Wallet size={20} />
          </div>
          <div>
            <h1 className="page-header-title">Quản lý Ngân sách</h1>
            <p className="page-header-subtitle">
              Thiết lập hạn mức chi tiêu theo danh mục • Tự động kết chuyển số dư theo thời gian thực ({filterDate.label})
            </p>
          </div>
        </div>
      </div>

      {/* Automatic Real-time Rollover Banner */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 shadow-2xs">
        <div className="flex items-center gap-2.5 text-xs">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Sparkles size={15} />
          </div>
          <div>
            <p className="font-bold text-emerald-900">
              Cơ chế tự động cộng dồn số dư theo thời gian thực đang bật
            </p>
            <p className="text-emerald-800/90 mt-0.5">
              {totalRolloverAmount > 0 ? (
                <>
                  Đã tự động cộng <strong>+{formatCurrency(totalRolloverAmount)}</strong> hạn mức chưa tiêu từ{" "}
                  <strong>{prevMonthLabel}</strong> vào tổng ngân sách <strong>{filterDate.label.toLowerCase()}</strong>.
                </>
              ) : (
                <>
                  Hệ thống tự động kế thừa ngân sách định kỳ và cộng phần hạn mức chưa sử dụng từ {prevMonthLabel.toLowerCase()} sang{" "}
                  {filterDate.label.toLowerCase()} mà không cần kích hoạt thủ công.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <div className="kpi-card" style={{ "--kpi-accent": "var(--brand)" } as React.CSSProperties}>
          <div className="kpi-card-header">
            <div className="kpi-card-icon bg-orange-100 text-orange-600">
              <PiggyBank size={18} />
            </div>
            <span className="kpi-card-label text-orange-700">Tổng ngân sách khả dụng</span>
          </div>
          <p className="kpi-card-value text-foreground">{formatCurrency(totalLimit)}</p>
          <p className="kpi-card-sub">
            {totalRolloverAmount > 0
              ? `Gốc: ${formatCurrency(totalBaseLimit)} + Dư T.trước: +${formatCurrency(totalRolloverAmount)}`
              : `${filterDate.label} (Tự động kết chuyển)`}
          </p>
        </div>

        <div className="kpi-card" style={{ "--kpi-accent": "#e11d48" } as React.CSSProperties}>
          <div className="kpi-card-header">
            <div className="kpi-card-icon bg-rose-100 text-rose-600">
              <TrendingDown size={18} />
            </div>
            <span className="kpi-card-label text-rose-700">Đã chi tiêu</span>
          </div>
          <p className="kpi-card-value text-rose-600">{formatCurrency(totalSpent)}</p>
          <p className="kpi-card-sub">Tỷ lệ: {formatMetric(overallPercent)}%</p>
        </div>

        <div className="kpi-card" style={{ "--kpi-accent": remaining >= 0 ? "#059669" : "#e11d48" } as React.CSSProperties}>
          <div className="kpi-card-header">
            <div className={`kpi-card-icon ${remaining >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
              <AlertCircle size={18} />
            </div>
            <span className={`kpi-card-label ${remaining >= 0 ? "text-emerald-700" : "text-rose-700"}`}>Còn lại</span>
          </div>
          <p className={`kpi-card-value ${remaining >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatCurrency(remaining)}
          </p>
          <p className="kpi-card-sub">{remaining >= 0 ? "Trong tầm kiểm soát" : "Vượt ngân sách"}</p>
        </div>
      </div>

      {/* Budget List + Interactive Upsert Form */}
      <BudgetListClient
        budgets={budgets.map((b) => ({
          id: b.id,
          categoryId: b.categoryId,
          month: b.month,
          year: b.year,
          categoryName: b.category?.name || "Chung",
          categoryIcon: b.category?.icon || "📂",
          categoryColor: b.category?.color || "#ea580c",
          baseLimit: b.baseLimit,
          rolloverAmount: b.rolloverAmount,
          prevMonth: b.prevMonth,
          prevYear: b.prevYear,
          limit: b.limitAmount,
          spent: b.spent,
          percent: b.percent,
        }))}
        expenseCategories={expenseCategories}
        filterMonth={filterDate.month}
        filterYear={filterDate.year}
        isMonthAll={filterDate.month === "ALL"}
        filterLabel={filterDate.label}
      />
    </div>
  );
}
