import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, calcPercent, formatMetric, toDate } from "@/lib/utils";
import { createGoal, deleteGoal, contributeToGoal } from "@/actions/goals";
import { Trash2, Target, TrendingUp, PiggyBank, Plus } from "lucide-react";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";


export default async function GoalsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  try {
    const goals = await db.orm.public.Goal
      .where((g) => g.userId.eq(userId))
      .orderBy((g) => g.createdAt.desc())
      .all();

    const totalTarget = goals.reduce((sum, g) => sum + Number(g.targetAmount), 0);
    const totalSaved = goals.reduce((sum, g) => sum + Number(g.savedAmount), 0);
    const overallPercent = calcPercent(totalSaved, totalTarget);

    return (
      <div className="space-y-6 animate-fade-in w-full">
        {/* Page Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shadow-sm">
              <Target size={20} />
            </div>
            <div>
              <h1 className="page-header-title">Mục tiêu tiết kiệm</h1>
              <p className="page-header-subtitle">Lập kế hoạch và theo dõi tiến độ hoàn thành các dự định</p>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
          <div className="kpi-card" style={{ "--kpi-accent": "var(--savings)" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className="kpi-card-icon bg-purple-100 text-purple-600">
                <Target size={18} />
              </div>
              <span className="kpi-card-label text-purple-700">Tổng mục tiêu</span>
            </div>
            <p className="kpi-card-value text-foreground">{formatCurrency(totalTarget)}</p>
            <p className="kpi-card-sub">{goals.length} mục tiêu đang theo dõi</p>
          </div>

          <div className="kpi-card" style={{ "--kpi-accent": "#059669" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className="kpi-card-icon bg-emerald-100 text-emerald-600">
                <PiggyBank size={18} />
              </div>
              <span className="kpi-card-label text-emerald-700">Đã tích lũy</span>
            </div>
            <p className="kpi-card-value text-emerald-600">{formatCurrency(totalSaved)}</p>
            <p className="kpi-card-sub">Tiến độ tổng: {formatMetric(overallPercent)}%</p>
          </div>

          <div className="kpi-card" style={{ "--kpi-accent": "var(--brand)" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className="kpi-card-icon bg-orange-100 text-orange-600">
                <TrendingUp size={18} />
              </div>
              <span className="kpi-card-label text-orange-700">Tiến độ chung</span>
            </div>
            <p className="kpi-card-value text-orange-600">{formatMetric(overallPercent)}%</p>
            <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-orange-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(overallPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Goals Grid */}
        {goals.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🎯</span>
            <h2 className="empty-state-title">Chưa có mục tiêu nào</h2>
            <p className="empty-state-desc">Hãy tạo mục tiêu tiết kiệm đầu tiên để bắt đầu theo dõi tiến độ!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {goals.map((goal: any) => {
              const percent = calcPercent(Number(goal.savedAmount), Number(goal.targetAmount));
              const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.savedAmount));
              const isCompleted = Number(goal.savedAmount) >= Number(goal.targetAmount);

              let daysLeft: number | null = null;
              if (goal.deadline) {
                const diffTime = toDate(goal.deadline).getTime() - new Date().getTime();
                daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              }

              return (
                <div key={goal.id} className="card space-y-4 flex flex-col justify-between group hover:border-purple-200 transition-colors">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{goal.name}</h3>
                          {isCompleted && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                              Hoàn thành 🎉
                            </span>
                          )}
                        </div>
                        {goal.note && <p className="text-sm text-muted-foreground mt-1">{goal.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {daysLeft !== null && (
                          <div
                            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${
                              daysLeft < 30 && !isCompleted
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-slate-50 text-muted-foreground border-slate-200"
                            }`}
                          >
                            {daysLeft > 0 ? `Còn ${daysLeft} ngày` : "Quá hạn"}
                          </div>
                        )}
                        <form
                          action={async () => {
                            "use server";
                            await deleteGoal(goal.id);
                          }}
                        >
                          <button
                            type="submit"
                            title="Xóa mục tiêu"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-purple-600">{formatMetric(percent)}%</span>
                        <span className="text-muted-foreground text-xs">
                          Còn lại: <strong className="text-foreground">{formatCurrency(remaining)}</strong>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCompleted
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                              : "bg-gradient-to-r from-purple-600 to-violet-500"
                          }`}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
                        <span>
                          Đã nạp: <strong className="text-foreground">{formatCurrency(Number(goal.savedAmount))}</strong>
                        </span>
                        <span>Mục tiêu: {formatCurrency(Number(goal.targetAmount))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contribution form */}
                  {!isCompleted && (
                    <div className="pt-3 border-t border-border">
                      <form
                        action={async (fd) => {
                          "use server";
                          await contributeToGoal(goal.id, fd);
                        }}
                        className="flex gap-2"
                      >
                        <SmartCurrencyInput
                          name="amount"
                          placeholder="Số tiền nạp (₫)..."
                          className="form-input flex-1 text-sm"
                          containerClassName="flex-1"
                          required
                        />
                        <button type="submit" className="btn-primary py-2 px-4 text-xs whitespace-nowrap cursor-pointer">
                          + Nạp tiền
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Form */}
        <div className="card bg-gradient-to-br from-purple-50/50 to-white border-purple-200/60">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Plus size={16} className="text-purple-600" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Tạo mục tiêu mới</h2>
          </div>
          <form
            action={async (fd) => {
              "use server";
              await createGoal(fd);
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="form-label form-label-required">Tên mục tiêu</label>
              <input
                type="text"
                name="name"
                required
                className="form-input"
                placeholder="VD: Mua xe máy"
              />
            </div>
            <div>
              <label className="form-label form-label-required">Số tiền mục tiêu</label>
              <SmartCurrencyInput
                name="targetAmount"
                required
                className="form-input"
                placeholder="VD: 50.000.000"
                showQuickButtons
                showWordsPreview
              />
            </div>
            <div>
              <label className="form-label">Hạn chót (không bắt buộc)</label>
              <input type="date" name="deadline" className="form-input" />
            </div>
            <div>
              <label className="form-label">Ghi chú</label>
              <input
                type="text"
                name="note"
                className="form-input"
                placeholder="Thêm mô tả ngắn..."
              />
            </div>
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" className="w-full sm:w-auto btn-primary py-2.5 px-8 flex justify-center cursor-pointer">
                <Target size={16} className="mr-1.5" />
                Tạo mục tiêu
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  } catch (error) {
    console.error(error);
    return (
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <p className="empty-state-title text-rose-600">Đã xảy ra lỗi khi tải dữ liệu mục tiêu.</p>
      </div>
    );
  }
}
