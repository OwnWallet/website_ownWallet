import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, calcPercent, getFilterDateRange, toInstant, toDate } from "@/lib/utils";
import { BUDGET_WARNING_THRESHOLD, BUDGET_DANGER_THRESHOLD } from "@/lib/constants";
import { upsertBudget, deleteBudget } from "@/actions/budgets";
import { Trash2, PiggyBank, TrendingDown, AlertCircle, Wallet, Plus } from "lucide-react";

export const metadata = {
  title: "Ngân sách | wnWallet",
};

interface BudgetPageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
  }>;
}

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const resolvedSearchParams = (await searchParams) || {};
  const filterDate = getFilterDateRange(resolvedSearchParams.month, resolvedSearchParams.year);
  const fromInstant = toInstant(filterDate.from);
  const toInstantVal = toInstant(filterDate.to);

  let budgets: any[] = [];
  let expenseCategories: any[] = [];
  const spentMap = new Map<string, number>();
  const monthSpentMap = new Map<string, number>();

  try {
    let budgetQuery = db.orm.public.Budget
      .where((b) => b.userId.eq(userId))
      .where((b) => b.year.eq(filterDate.year));

    const targetMonth = filterDate.month;
    if (targetMonth !== "ALL") {
      budgetQuery = budgetQuery.where((b) => b.month.eq(targetMonth));
    }

    const [bList, cList, txList] = await Promise.all([
      budgetQuery
        .include("category", (cat) => cat)
        .orderBy((b) => b.month.asc())
        .all(),
      db.orm.public.Category
        .where((c) => c.userId.eq(userId))
        .where((c) => c.type.eq("EXPENSE"))
        .all(),
      db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .where((t) => t.type.eq("EXPENSE"))
        .where((t) => t.recordedAt.gte(fromInstant))
        .where((t) => t.recordedAt.lte(toInstantVal))
        .all(),
    ]);

    budgets = bList;
    expenseCategories = cList;

    txList.forEach((tx: any) => {
      const amt = Number(tx.amount);
      const prev = spentMap.get(tx.categoryId) || 0;
      spentMap.set(tx.categoryId, prev + amt);

      const d = toDate(tx.recordedAt);
      const m = d.getMonth() + 1;
      const mKey = `${tx.categoryId}_${m}`;
      monthSpentMap.set(mKey, (monthSpentMap.get(mKey) || 0) + amt);
    });
  } catch (error) {
    console.error("Failed to fetch budget data:", error);
    return (
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <p className="empty-state-title text-rose-600">Đã có lỗi xảy ra khi tải dữ liệu ngân sách.</p>
      </div>
    );
  }

  const totalLimit = budgets.reduce((sum, b) => sum + Number(b.limitAmount), 0);
  const totalSpent = filterDate.month === "ALL"
    ? Array.from(spentMap.values()).reduce((sum, v) => sum + v, 0)
    : budgets.reduce((sum, b) => sum + (spentMap.get(b.categoryId) || 0), 0);
  const overallPercent = calcPercent(totalSpent, totalLimit);
  const remaining = totalLimit - totalSpent;

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
              Thiết lập hạn mức chi tiêu theo danh mục • {filterDate.label}
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
            <span className="kpi-card-label text-orange-700">Tổng ngân sách</span>
          </div>
          <p className="kpi-card-value text-foreground">{formatCurrency(totalLimit)}</p>
          <p className="kpi-card-sub">{filterDate.label}</p>
        </div>

        <div className="kpi-card" style={{ "--kpi-accent": "#e11d48" } as React.CSSProperties}>
          <div className="kpi-card-header">
            <div className="kpi-card-icon bg-rose-100 text-rose-600">
              <TrendingDown size={18} />
            </div>
            <span className="kpi-card-label text-rose-700">Đã chi tiêu</span>
          </div>
          <p className="kpi-card-value text-rose-600">{formatCurrency(totalSpent)}</p>
          <p className="kpi-card-sub">Tỷ lệ: {overallPercent}%</p>
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

      {/* Budget List */}
      {budgets.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">💸</span>
          <h3 className="empty-state-title">Chưa có ngân sách cho {filterDate.label.toLowerCase()}</h3>
          <p className="empty-state-desc">Hãy thiết lập ngân sách bên dưới để bắt đầu theo dõi chi tiêu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {budgets.map((b) => {
            const limit = Number(b.limitAmount);
            const spent = filterDate.month === "ALL"
              ? (monthSpentMap.get(`${b.categoryId}_${b.month}`) || 0)
              : (spentMap.get(b.categoryId) || 0);
            const percent = calcPercent(spent, limit);
            const isWarning = percent >= BUDGET_WARNING_THRESHOLD * 100;
            const isDanger = percent >= BUDGET_DANGER_THRESHOLD * 100;

            const progressColor = isDanger ? "#e11d48" : isWarning ? "#d97706" : "#059669";
            const statusBadge = isDanger
              ? { text: "Vượt hạn mức", bg: "bg-rose-50 text-rose-700 border-rose-200" }
              : isWarning
              ? { text: "Sắp vượt", bg: "bg-amber-50 text-amber-700 border-amber-200" }
              : null;

            return (
              <div key={b.id} className="card flex flex-col gap-4 relative overflow-hidden group hover:border-orange-200 transition-colors">
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: progressColor, opacity: 0.6 }} />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border"
                      style={{
                        backgroundColor: `${b.category?.color || "#ea580c"}12`,
                        borderColor: `${b.category?.color || "#ea580c"}30`,
                      }}
                    >
                      {b.category?.icon || "📂"}
                    </div>
                    <div>
                      <span className="font-bold text-base block">{b.category?.name}</span>
                      {filterDate.month === "ALL" && (
                        <span className="text-xs font-medium text-muted-foreground">
                          Tháng {b.month}/{b.year}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${statusBadge.bg}`}>
                        {statusBadge.text}
                      </span>
                    )}
                    <form
                      action={async () => {
                        "use server";
                        await deleteBudget(b.id);
                      }}
                    >
                      <button
                        type="submit"
                        title="Xóa ngân sách"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      Đã chi: <span className="text-foreground font-semibold">{formatCurrency(spent)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Hạn mức: <span className="text-foreground font-semibold">{formatCurrency(limit)}</span>
                    </span>
                  </div>

                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: progressColor,
                      }}
                    />
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-xs font-bold" style={{ color: progressColor }}>
                      {percent}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Upsert Budget Form */}
      <div className="card bg-gradient-to-br from-orange-50/40 to-white border-orange-200/60">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <Plus size={16} className="text-orange-600" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            Thiết lập ngân sách {filterDate.month === "ALL" ? `cho năm ${filterDate.year}` : `cho ${filterDate.label.toLowerCase()}`}
          </h2>
        </div>
        <form
          action={async (fd) => {
            "use server";
            await upsertBudget(fd);
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          {filterDate.month === "ALL" ? (
            <div>
              <label className="form-label form-label-required">Tháng áp dụng</label>
              <select
                name="month"
                defaultValue={new Date().getMonth() + 1}
                className="form-input"
                required
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="month" value={filterDate.month} />
          )}
          <input type="hidden" name="year" value={filterDate.year} />

          <div>
            <label className="form-label form-label-required">Danh mục</label>
            <select name="categoryId" className="form-input" required>
              <option value="">-- Chọn danh mục --</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label form-label-required">Hạn mức (₫)</label>
            <input
              type="number"
              name="limitAmount"
              placeholder="VD: 5000000"
              className="form-input"
              min="1"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary py-2.5 px-6 cursor-pointer"
          >
            <PiggyBank size={16} className="mr-1.5" />
            Lưu ngân sách
          </button>
        </form>
      </div>
    </div>
  );
}
