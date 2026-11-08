"use client";

import { useState, useTransition } from "react";
import {
  Trash2,
  Target,
  Plus,
  Edit2,
  History,
  Loader2,
  X,
  Check,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, calcPercent, formatMetric, formatDate, toDate } from "@/lib/utils";
import { createGoal, updateGoal, deleteGoal, contributeToGoal } from "@/actions/goals";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface ContributionItem {
  id: string;
  amount: number;
  note?: string | null;
  recordedAt: string;
}

export interface GoalItem {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  note: string | null;
  contributions: ContributionItem[];
}

interface WalletOption {
  id: string;
  name: string;
  bankName?: string | null;
  currentBalance?: number;
  isDefault?: boolean;
}

interface GoalsClientProps {
  goals: GoalItem[];
  wallets: WalletOption[];
}

export function GoalsClient({ goals, wallets }: GoalsClientProps) {
  const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];
  const [deleteTarget, setDeleteTarget] = useState<GoalItem | null>(null);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [newTargetAmount, setNewTargetAmount] = useState<number | string>("");
  const [editTargetAmount, setEditTargetAmount] = useState<number | string>("");
  const [contribAmounts, setContribAmounts] = useState<Record<string, number | string>>({});
  const [contribWallets, setContribWallets] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const handleCreateGoal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    startTransition(async () => {
      const res = await createGoal(fd);
      if ((res as any)?.error) {
        const err = (res as any).error;
        const msg = typeof err === "string" ? err : Object.values(err).flat()[0] || "Không thể tạo mục tiêu";
        toast.error(String(msg));
      } else {
        toast.success("Đã tạo mục tiêu tiết kiệm mới!");
        formEl.reset();
        setNewTargetAmount("");
      }
    });
  };

  const handleUpdateGoal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGoal) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateGoal(editingGoal.id, fd);
      if ((res as any)?.error) {
        const err = (res as any).error;
        const msg = typeof err === "string" ? err : Object.values(err).flat()[0] || "Không thể cập nhật mục tiêu";
        toast.error(String(msg));
      } else {
        toast.success(`Đã cập nhật mục tiêu "${editingGoal.name}"`);
        setEditingGoal(null);
      }
    });
  };

  const handleContribute = (goal: GoalItem, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await contributeToGoal(goal.id, fd);
      if ((res as any)?.error) {
        const err = (res as any).error;
        const msg = typeof err === "string" ? err : Object.values(err).flat()[0] || "Không thể nạp tiền";
        toast.error(String(msg));
      } else {
        toast.success(`Đã nạp thêm tiền vào mục tiêu "${goal.name}" 🎉`);
        setContribAmounts((prev) => ({ ...prev, [goal.id]: "" }));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🎯</span>
          <h2 className="empty-state-title">Chưa có mục tiêu nào</h2>
          <p className="empty-state-desc">Hãy tạo mục tiêu tiết kiệm đầu tiên bên dưới để bắt đầu theo dõi tiến độ!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {goals.map((goal) => {
            const percent = calcPercent(goal.savedAmount, goal.targetAmount);
            const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
            const isCompleted = goal.savedAmount >= goal.targetAmount;
            const isHistoryOpen = expandedHistoryId === goal.id;

            let daysLeft: number | null = null;
            if (goal.deadline) {
              const diffTime = toDate(goal.deadline).getTime() - new Date().getTime();
              daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            const selectedWalletForGoal =
              contribWallets[goal.id] ?? (defaultWallet?.id || "NONE");

            return (
              <div
                key={goal.id}
                className="card space-y-4 flex flex-col justify-between group hover:border-purple-200 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg truncate">{goal.name}</h3>
                        {isCompleted && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            Hoàn thành 🎉
                          </span>
                        )}
                      </div>
                      {goal.note && <p className="text-sm text-muted-foreground mt-1">{goal.note}</p>}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {daysLeft !== null && (
                        <div
                          className={`text-xs px-2 py-0.5 rounded-lg border font-semibold ${
                            daysLeft < 30 && !isCompleted
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-50 text-muted-foreground border-slate-200"
                          }`}
                        >
                          {daysLeft > 0 ? `Còn ${daysLeft} ngày` : "Quá hạn"}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGoal(goal);
                          setEditTargetAmount(goal.targetAmount);
                        }}
                        title="Chỉnh sửa mục tiêu"
                        aria-label={`Chỉnh sửa mục tiêu ${goal.name}`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(goal)}
                        title="Xóa mục tiêu"
                        aria-label={`Xóa mục tiêu ${goal.name}`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-purple-600">{formatMetric(percent)}%</span>
                      <span className="text-muted-foreground text-xs">
                        Còn thiếu: <strong className="text-foreground">{formatCurrency(remaining)}</strong>
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
                        Đã nạp: <strong className="text-foreground">{formatCurrency(goal.savedAmount)}</strong>
                      </span>
                      <span>Mục tiêu: {formatCurrency(goal.targetAmount)}</span>
                    </div>
                  </div>

                  {/* Contribution History Toggle */}
                  {goal.contributions.length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(isHistoryOpen ? null : goal.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 cursor-pointer"
                      >
                        <History size={13} />
                        <span>
                          {isHistoryOpen
                            ? "Ẩn lịch sử nạp"
                            : `Xem lịch sử nạp (${goal.contributions.length} lần)`}
                        </span>
                      </button>

                      {isHistoryOpen && (
                        <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 rounded-xl bg-slate-50 p-2.5 border border-slate-200/70 text-xs">
                          {goal.contributions.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground truncate">
                                {formatDate(c.recordedAt)}
                              </span>
                              <span className="font-bold text-emerald-600 shrink-0">
                                +{formatCurrency(c.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Contribution form with Wallet Selector */}
                {!isCompleted && (
                  <div className="pt-3 border-t border-border">
                    <form onSubmit={(e) => handleContribute(goal, e)} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Wallet size={13} className="text-muted-foreground shrink-0" />
                        <select
                          name="walletId"
                          value={selectedWalletForGoal}
                          onChange={(e) =>
                            setContribWallets((prev) => ({ ...prev, [goal.id]: e.target.value }))
                          }
                          aria-label="Chọn ví trích tiền tiết kiệm"
                          className="text-xs bg-slate-50 border border-border rounded-lg px-2 py-1.5 text-foreground font-medium flex-1 min-w-0 focus:outline-none focus:border-purple-400"
                        >
                          {wallets.map((w) => (
                            <option key={w.id} value={w.id}>
                              Trừ từ: {w.name} ({formatCurrency(w.currentBalance ?? 0)})
                            </option>
                          ))}
                          <option value="NONE">-- Không trừ số dư ví --</option>
                        </select>
                      </div>

                      <div className="flex gap-2 items-start">
                        <SmartCurrencyInput
                          name="amount"
                          value={contribAmounts[goal.id] ?? ""}
                          onChangeValue={(val) =>
                            setContribAmounts((prev) => ({ ...prev, [goal.id]: val }))
                          }
                          placeholder="Số tiền nạp (₫)..."
                          className="form-input flex-1 text-sm py-2"
                          containerClassName="flex-1"
                          required
                        />
                        <button
                          type="submit"
                          disabled={isPending}
                          className="btn-primary py-2 px-3.5 text-xs whitespace-nowrap cursor-pointer disabled:opacity-60"
                        >
                          {isPending ? <Loader2 size={14} className="animate-spin" /> : "+ Nạp tiền"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                Chỉnh sửa mục tiêu: {editingGoal.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                aria-label="Đóng hộp thoại"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateGoal} className="space-y-3.5">
              <div>
                <label className="form-label form-label-required">Tên mục tiêu</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingGoal.name}
                  required
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label form-label-required">Số tiền mục tiêu (₫)</label>
                <SmartCurrencyInput
                  name="targetAmount"
                  value={editTargetAmount}
                  onChangeValue={(val) => setEditTargetAmount(val)}
                  required
                  className="form-input"
                  showQuickButtons
                  showWordsPreview
                />
              </div>

              <div>
                <label className="form-label">Hạn chót</label>
                <input
                  type="date"
                  name="deadline"
                  defaultValue={
                    editingGoal.deadline ? editingGoal.deadline.slice(0, 10) : ""
                  }
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Ghi chú</label>
                <input
                  type="text"
                  name="note"
                  defaultValue={editingGoal.note || ""}
                  className="form-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary py-2 px-5 text-xs cursor-pointer disabled:opacity-60"
                >
                  {isPending ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <Check size={14} className="mr-1.5" />
                  )}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Goal Form */}
      <div className="card bg-gradient-to-br from-purple-50/50 to-white border-purple-200/60">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Plus size={16} className="text-purple-600" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Tạo mục tiêu tiết kiệm mới</h2>
        </div>
        <form onSubmit={handleCreateGoal} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label form-label-required">Tên mục tiêu</label>
            <input
              type="text"
              name="name"
              required
              className="form-input"
              placeholder="VD: Mua xe máy, Quỹ khẩn cấp 6 tháng..."
            />
          </div>
          <div>
            <label className="form-label form-label-required">Số tiền mục tiêu (₫)</label>
            <SmartCurrencyInput
              name="targetAmount"
              value={newTargetAmount}
              onChangeValue={(val) => setNewTargetAmount(val)}
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
            <button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto btn-primary py-2.5 px-8 flex justify-center cursor-pointer disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 size={16} className="mr-1.5 animate-spin" />
              ) : (
                <Target size={16} className="mr-1.5" />
              )}
              {isPending ? "Đang tạo..." : "Tạo mục tiêu"}
            </button>
          </div>
        </form>
      </div>

      {/* Delete Goal Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">Xác nhận xóa mục tiêu</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa mục tiêu &ldquo;{deleteTarget?.name}&rdquo;? Các giao dịch tiết kiệm trước đó sẽ vẫn được giữ lại trong sổ giao dịch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={async () => {
                if (deleteTarget) {
                  const res = await deleteGoal(deleteTarget.id);
                  if ((res as any)?.error) {
                    toast.error(String((res as any).error));
                  } else {
                    toast.success("Đã xóa mục tiêu tiết kiệm");
                  }
                  setDeleteTarget(null);
                }
              }}
            >
              Xóa mục tiêu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

