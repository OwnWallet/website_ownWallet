import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, calcPercent } from "@/lib/utils";
import { createGoal, deleteGoal, contributeToGoal } from "@/actions/goals";
import { Trash2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mục tiêu tích lũy | wnWallet",
};

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
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Mục tiêu tiết kiệm</h1>
            <p className="text-muted text-sm mt-1">Lập kế hoạch và theo dõi tiến độ hoàn thành các dự định</p>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5">
            <p className="text-muted text-xs font-medium uppercase tracking-wider">Tổng mục tiêu</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{formatCurrency(totalTarget)}</p>
          </div>
          <div className="card p-5">
            <p className="text-muted text-xs font-medium uppercase tracking-wider">Đã tích lũy</p>
            <p className="text-2xl font-bold mt-1 text-savings">{formatCurrency(totalSaved)}</p>
          </div>
          <div className="card p-5">
            <p className="text-muted text-xs font-medium uppercase tracking-wider">Tiến độ chung</p>
            <p className="text-2xl font-bold mt-1 text-primary">{overallPercent}%</p>
          </div>
        </div>

        {/* Goals Grid */}
        {goals.length === 0 ? (
          <div className="card text-center py-12 border-dashed">
            <p className="text-4xl mb-3">🎯</p>
            <h2 className="text-lg font-semibold mb-1">Chưa có mục tiêu nào</h2>
            <p className="text-muted text-sm mb-4">Hãy tạo mục tiêu tiết kiệm đầu tiên để bắt đầu theo dõi tiến độ!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goals.map((goal: any) => {
              const percent = calcPercent(Number(goal.savedAmount), Number(goal.targetAmount));
              const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.savedAmount));
              const isCompleted = Number(goal.savedAmount) >= Number(goal.targetAmount);

              let daysLeft: number | null = null;
              if (goal.deadline) {
                const diffTime = new Date(goal.deadline).getTime() - new Date().getTime();
                daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              }

              return (
                <div key={goal.id} className="card space-y-4 flex flex-col justify-between group">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{goal.name}</h3>
                          {isCompleted && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-income/10 text-income border border-income/20 font-medium">
                              Đã hoàn thành 🎉
                            </span>
                          )}
                        </div>
                        {goal.note && <p className="text-sm text-muted mt-1">{goal.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {daysLeft !== null && (
                          <div
                            className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
                              daysLeft < 30 && !isCompleted
                                ? "bg-danger/10 text-danger border-danger/20"
                                : "bg-elevated text-muted border-border-strong"
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
                            className="p-1.5 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-savings">{percent}%</span>
                        <span className="text-muted text-xs">
                          Còn lại: <strong className="text-foreground">{formatCurrency(remaining)}</strong>
                        </span>
                      </div>
                      <div className="w-full bg-elevated rounded-full h-2.5 overflow-hidden border border-border-strong">
                        <div
                          className="h-full bg-gradient-to-r from-savings to-primary transition-all duration-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted pt-1">
                        <span>
                          Đã nạp: <strong className="text-foreground">{formatCurrency(Number(goal.savedAmount))}</strong>
                        </span>
                        <span>Mục tiêu: {formatCurrency(Number(goal.targetAmount))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contribution form */}
                  {!isCompleted && (
                    <div className="pt-4 border-t border-border-strong">
                      <form
                        action={async (fd) => {
                          "use server";
                          await contributeToGoal(goal.id, fd);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="number"
                          name="amount"
                          placeholder="Số tiền nạp (₫)..."
                          className="flex-1 bg-elevated border border-border-strong rounded px-3 py-2 text-xs outline-none focus:border-primary transition-colors text-foreground"
                          required
                          min="1"
                        />
                        <button type="submit" className="btn-primary py-1.5 px-4 text-xs whitespace-nowrap cursor-pointer">
                          Nạp tiền
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
        <div className="card mt-8">
          <h2 className="text-xl font-semibold mb-4">Tạo mục tiêu mới</h2>
          <form
            action={async (fd) => {
              "use server";
              await createGoal(fd);
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="space-y-1">
              <label className="text-sm text-muted">
                Tên mục tiêu <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                className="w-full bg-elevated border border-border-strong rounded px-3 py-2 outline-none focus:border-primary"
                placeholder="VD: Mua xe máy"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted">
                Số tiền mục tiêu <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                name="targetAmount"
                required
                min="1"
                className="w-full bg-elevated border border-border-strong rounded px-3 py-2 outline-none focus:border-primary"
                placeholder="50000000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted">Hạn chót (không bắt buộc)</label>
              <input
                type="date"
                name="deadline"
                className="w-full bg-elevated border border-border-strong rounded px-3 py-2 outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted">Ghi chú</label>
              <input
                type="text"
                name="note"
                className="w-full bg-elevated border border-border-strong rounded px-3 py-2 outline-none focus:border-primary"
                placeholder="Thêm mô tả ngắn..."
              />
            </div>
            <div className="md:col-span-2 flex justify-end mt-4">
              <button type="submit" className="w-full btn-primary py-2.5 mt-2 flex justify-center cursor-pointer">
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
      <div className="card text-center text-danger py-12">
        <p>Đã xảy ra lỗi khi tải dữ liệu mục tiêu.</p>
      </div>
    );
  }
}
