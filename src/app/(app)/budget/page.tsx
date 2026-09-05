import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, calcPercent, getFilterDateRange, toInstant, toDate } from "@/lib/utils";
import { BUDGET_WARNING_THRESHOLD, BUDGET_DANGER_THRESHOLD } from "@/lib/constants";
import { upsertBudget, deleteBudget } from "@/actions/budgets";
import { Trash2, PiggyBank, TrendingDown, AlertCircle } from "lucide-react";

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
      <div className="p-8 text-center" style={{ color: "var(--color-expense)" }}>
        Đã có lỗi xảy ra khi tải dữ liệu ngân sách.
      </div>
    );
  }

  const totalLimit = budgets.reduce((sum, b) => sum + Number(b.limitAmount), 0);
  const totalSpent = filterDate.month === "ALL"
    ? Array.from(spentMap.values()).reduce((sum, v) => sum + v, 0)
    : budgets.reduce((sum, b) => sum + (spentMap.get(b.categoryId) || 0), 0);
  const overallPercent = calcPercent(totalSpent, totalLimit);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Quản lý Ngân sách</h1>
          <p className="text-muted text-sm mt-1">
            Thiết lập hạn mức chi tiêu theo danh mục để kiểm soát tài chính hiệu quả
          </p>
        </div>
      </div>


      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center justify-between border-primary/20 bg-primary/5">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Tổng ngân sách</p>
            <p className="text-xl md:text-2xl font-extrabold text-foreground mt-1">
              {formatCurrency(totalLimit)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{filterDate.label}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
            <PiggyBank size={20} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-rose-500/20 bg-rose-500/5">
          <div>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Đã chi tiêu</p>
            <p className="text-xl md:text-2xl font-extrabold text-rose-600 mt-1">
              {formatCurrency(totalSpent)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tỷ lệ: {overallPercent}%</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-600">
            <TrendingDown size={20} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-amber-500/20 bg-amber-500/5">
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Còn lại</p>
            <p className={`text-xl md:text-2xl font-extrabold mt-1 ${totalLimit - totalSpent >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatCurrency(totalLimit - totalSpent)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totalLimit - totalSpent >= 0 ? "Trong tầm kiểm soát" : "Vượt ngân sách"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* Budget List */}
      {budgets.length === 0 ? (
        <div className="text-center p-12 card border-dashed">
          <div className="text-5xl mb-4">💸</div>
          <h3 className="text-xl font-semibold mb-2">Chưa có ngân sách cho {filterDate.label.toLowerCase()}</h3>
          <p className="text-muted text-sm">Hãy thiết lập ngân sách bên dưới để bắt đầu theo dõi chi tiêu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((b) => {
            const limit = Number(b.limitAmount);
            const spent = filterDate.month === "ALL"
              ? (monthSpentMap.get(`${b.categoryId}_${b.month}`) || 0)
              : (spentMap.get(b.categoryId) || 0);
            const percent = calcPercent(spent, limit);
            const isWarning = percent >= BUDGET_WARNING_THRESHOLD * 100;
            const isDanger = percent >= BUDGET_DANGER_THRESHOLD * 100;

            let progressColor = "var(--color-income)";
            if (isDanger) progressColor = "var(--color-expense)";
            else if (isWarning) progressColor = "var(--color-debt)";

            return (
              <div key={b.id} className="card flex flex-col gap-4 relative overflow-hidden group shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-elevated border"
                      style={{ borderColor: b.category?.color || "#ea580c" }}
                    >
                      {b.category?.icon || "📂"}
                    </div>
                    <div>
                      <span className="font-semibold text-base block">{b.category?.name}</span>
                      {filterDate.month === "ALL" && (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Tháng {b.month}/{b.year}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDanger ? (
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--color-expense) 15%, transparent)",
                          color: "var(--color-expense)",
                          border: "1px solid color-mix(in srgb, var(--color-expense) 30%, transparent)",
                        }}
                      >
                        Vượt hạn mức
                      </span>
                    ) : isWarning ? (
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--color-debt) 15%, transparent)",
                          color: "var(--color-debt)",
                          border: "1px solid color-mix(in srgb, var(--color-debt) 30%, transparent)",
                        }}
                      >
                        Sắp vượt
                      </span>
                    ) : null}
                    <form
                      action={async () => {
                        "use server";
                        await deleteBudget(b.id);
                      }}
                    >
                      <button
                        type="submit"
                        title="Xóa ngân sách"
                        className="p-1.5 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted">
                      Đã chi: <span className="text-foreground font-medium">{formatCurrency(spent)}</span>
                    </span>
                    <span className="text-muted">
                      Hạn mức: <span className="text-foreground font-medium">{formatCurrency(limit)}</span>
                    </span>
                  </div>

                  <div className="h-2 w-full bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: progressColor,
                      }}
                    />
                  </div>
                  <div className="mt-2 text-right text-xs text-muted">{percent}%</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Upsert Budget Form */}
      <div className="card mt-8 bg-elevated" style={{ borderColor: "var(--border-strong)" }}>
        <h2 className="text-lg font-semibold mb-4">
          Thiết lập ngân sách {filterDate.month === "ALL" ? `cho năm ${filterDate.year}` : `cho ${filterDate.label.toLowerCase()}`}
        </h2>
        <form
          action={async (fd) => {
            "use server";
            await upsertBudget(fd);
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          {filterDate.month === "ALL" ? (
            <div className="w-full">
              <label className="block text-sm font-medium text-muted mb-2">
                Tháng áp dụng <span className="text-danger">*</span>
              </label>
              <select
                name="month"
                defaultValue={new Date().getMonth() + 1}
                className="w-full bg-background rounded text-foreground focus:outline-none"
                style={{ border: "1px solid var(--border-strong)", padding: "10px 16px" }}
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

          <div className="w-full">
            <label className="block text-sm font-medium text-muted mb-2">
              Danh mục <span className="text-danger">*</span>
            </label>
            <select
              name="categoryId"
              className="w-full bg-background rounded text-foreground focus:outline-none"
              style={{ border: "1px solid var(--border-strong)", padding: "10px 16px" }}
              required
            >
              <option value="">-- Chọn danh mục --</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-muted mb-2">
              Hạn mức (₫) <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              name="limitAmount"
              placeholder="VD: 5000000"
              className="w-full bg-background rounded text-foreground focus:outline-none"
              style={{ border: "1px solid var(--border-strong)", padding: "10px 16px" }}
              min="1"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full px-6 py-2.5 rounded transition-colors font-medium cursor-pointer"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Lưu ngân sách
          </button>
        </form>
      </div>
    </div>
  );
}
