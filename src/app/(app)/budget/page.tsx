import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, calcPercent, getCurrentMonthRange, toInstant } from "@/lib/utils";
import { BUDGET_WARNING_THRESHOLD, BUDGET_DANGER_THRESHOLD } from "@/lib/constants";
import { upsertBudget, deleteBudget } from "@/actions/budgets";
import { Trash2 } from "lucide-react";

export const metadata = {
  title: "Ngân sách | wnWallet",
};

export default async function BudgetPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const { from, to } = getCurrentMonthRange();
  const fromInstant = toInstant(from);
  const toInstantVal = toInstant(to);

  let budgets: any[] = [];
  let expenseCategories: any[] = [];
  const spentMap = new Map<string, number>();

  try {
    const [bList, cList, txList] = await Promise.all([
      db.orm.public.Budget
        .where((b) => b.userId.eq(userId))
        .where((b) => b.month.eq(currentMonth))
        .where((b) => b.year.eq(currentYear))
        .include("category", (cat) => cat)
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
      const prev = spentMap.get(tx.categoryId) || 0;
      spentMap.set(tx.categoryId, prev + Number(tx.amount));
    });
  } catch (error) {
    console.error("Failed to fetch budget data:", error);
    return (
      <div className="p-8 text-center" style={{ color: "var(--color-expense)" }}>
        Đã có lỗi xảy ra khi tải dữ liệu ngân sách.
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ngân sách</h1>
          <p className="text-muted mt-1">
            Tháng {currentMonth} / {currentYear}
          </p>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center p-12 card border-dashed">
          <div className="text-5xl mb-4">💸</div>
          <h3 className="text-xl font-semibold mb-2">Chưa có ngân sách nào</h3>
          <p className="text-muted">Hãy thiết lập ngân sách để kiểm soát chi tiêu tốt hơn.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((b) => {
            const limit = Number(b.limitAmount);
            const spent = spentMap.get(b.categoryId) || 0;
            const percent = calcPercent(spent, limit);
            const isWarning = percent >= BUDGET_WARNING_THRESHOLD * 100;
            const isDanger = percent >= BUDGET_DANGER_THRESHOLD * 100;

            let progressColor = "var(--color-income)";
            if (isDanger) progressColor = "var(--color-expense)";
            else if (isWarning) progressColor = "var(--color-debt)";

            return (
              <div key={b.id} className="card flex flex-col gap-4 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-elevated border"
                      style={{ borderColor: b.category?.color || "#ea580c" }}
                    >
                      {b.category?.icon || "📂"}
                    </div>
                    <span className="font-semibold text-lg">{b.category?.name}</span>
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

      <div className="card mt-12 bg-elevated" style={{ borderColor: "var(--border-strong)" }}>
        <h2 className="text-xl font-semibold mb-4">Thêm ngân sách</h2>
        <form
          action={async (fd) => {
            "use server";
            await upsertBudget(fd);
          }}
          className="flex flex-col md:flex-row gap-4 items-end"
        >
          <input type="hidden" name="month" value={currentMonth} />
          <input type="hidden" name="year" value={currentYear} />

          <div className="mb-4 flex-1 w-full">
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

          <div className="mb-4 flex-1 w-full">
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
            className="w-full md:w-auto px-6 py-2 rounded transition-colors font-medium cursor-pointer"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Lưu ngân sách
          </button>
        </form>
      </div>
    </div>
  );
}
