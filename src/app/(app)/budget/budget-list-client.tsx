"use client";

import { useState, useTransition, useRef } from "react";
import { Trash2, Plus, PiggyBank, Loader2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatMetric } from "@/lib/utils";
import { BUDGET_WARNING_THRESHOLD, BUDGET_DANGER_THRESHOLD } from "@/lib/constants";
import { upsertBudget, deleteBudget, deleteBudgets } from "@/actions/budgets";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
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

export interface BudgetItemData {
  id: string;
  categoryId: string;
  month: number;
  year: number;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string;
  baseLimit?: number;
  rolloverAmount?: number;
  prevMonth?: number;
  prevYear?: number;
  limit: number;
  spent: number;
  percent: number;
}

interface BudgetListClientProps {
  budgets: BudgetItemData[];
  expenseCategories: { id: string; name: string; icon?: string | null }[];
  filterMonth: number | "ALL";
  filterYear: number;
  isMonthAll: boolean;
  filterLabel: string;
}

export function BudgetListClient({
  budgets,
  expenseCategories,
  filterMonth,
  filterYear,
  isMonthAll,
  filterLabel,
}: BudgetListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteSingleTarget, setDeleteSingleTarget] = useState<BudgetItemData | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [limitVal, setLimitVal] = useState<number | string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    typeof filterMonth === "number" ? filterMonth : new Date().getMonth() + 1
  );
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);

  const handleCategoryChange = (catId: string) => {
    setSelectedCatId(catId);
    const existing = budgets.find(
      (b) => b.categoryId === catId && (isMonthAll ? b.month === selectedMonth : true)
    );
    if (existing) {
      setLimitVal(existing.baseLimit ?? existing.limit);
    }
  };

  const handleEditBudget = (b: BudgetItemData) => {
    setSelectedCatId(b.categoryId);
    setLimitVal(b.baseLimit ?? b.limit);
    if (isMonthAll) setSelectedMonth(b.month);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleUpsertSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await upsertBudget(fd);
      if ((res as any)?.error) {
        const err = (res as any).error;
        const msg = typeof err === "string" ? err : Object.values(err).flat()[0] || "Không thể lưu ngân sách";
        toast.error(String(msg));
      } else {
        toast.success("Đã lưu thiết lập ngân sách thành công");
        setSelectedCatId("");
        setLimitVal("");
      }
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === budgets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(budgets.map((b) => b.id)));
    }
  };

  return (
    <div className="space-y-6">
      {budgets.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">💸</span>
          <h3 className="empty-state-title">Chưa có ngân sách cho {filterLabel.toLowerCase()}</h3>
          <p className="empty-state-desc">Hãy thiết lập ngân sách bên dưới để bắt đầu theo dõi chi tiêu.</p>
        </div>
      ) : (
        <>
          {/* Selection toolbar — month view only. Year-view cards are aggregates of
              several monthly budgets, so editing/deleting them would hit the wrong record. */}
          {isMonthAll ? (
            <p className="px-1 text-xs font-medium text-slate-600">
              Đang xem tổng hợp cả năm {filterYear}. Chọn một tháng cụ thể ở thanh bên để chỉnh sửa hoặc xóa hạn mức.
            </p>
          ) : (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary/30 cursor-pointer accent-primary"
                checked={selectedIds.size === budgets.length && budgets.length > 0}
                onChange={toggleSelectAll}
                id="select-all-budgets"
              />
              <label htmlFor="select-all-budgets" className="text-xs font-semibold text-muted-foreground cursor-pointer select-none">
                {selectedIds.size === budgets.length ? "Bỏ chọn tất cả" : `Chọn tất cả (${budgets.length})`}
              </label>
            </div>
          </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {budgets.map((b) => {
              const isWarning = b.percent >= BUDGET_WARNING_THRESHOLD * 100;
              const isDanger = b.percent >= BUDGET_DANGER_THRESHOLD * 100;

              const progressColor = isDanger ? "#e11d48" : isWarning ? "#d97706" : "#059669";
              const statusBadge = isDanger
                ? { text: "Vượt hạn mức", bg: "bg-rose-50 text-rose-700 border-rose-200" }
                : isWarning
                ? { text: "Sắp vượt", bg: "bg-amber-50 text-amber-700 border-amber-200" }
                : null;

              const isSelected = selectedIds.has(b.id);
              const hasRollover = (b.rolloverAmount ?? 0) > 0;

              return (
                <div
                  key={b.id}
                  className={`card flex flex-col gap-4 relative overflow-hidden group transition-all ${
                    isSelected ? "ring-2 ring-primary/50 bg-primary/5 border-primary/40" : "hover:border-orange-200"
                  }`}
                >
                  {/* Top accent line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                    style={{ backgroundColor: progressColor, opacity: 0.6 }}
                  />

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {!isMonthAll && (
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary/30 cursor-pointer accent-primary shrink-0"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(b.id)}
                          title="Chọn ngân sách này"
                        />
                      )}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border shrink-0"
                        style={{
                          backgroundColor: `${b.categoryColor || "#ea580c"}12`,
                          borderColor: `${b.categoryColor || "#ea580c"}30`,
                        }}
                      >
                        {b.categoryIcon || "📂"}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-base block truncate">{b.categoryName}</span>
                        {isMonthAll && (
                          <span className="text-xs font-medium text-muted-foreground">
                            Tổng cả năm {b.year}
                          </span>
                        )}
                        {hasRollover && (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                            +Dư T{b.prevMonth}/{b.prevYear}: +{formatCurrency(b.rolloverAmount!)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {statusBadge && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${statusBadge.bg}`}>
                          {statusBadge.text}
                        </span>
                      )}
                      {!isMonthAll && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditBudget(b)}
                            title="Điều chỉnh hạn mức"
                            aria-label={`Điều chỉnh hạn mức ${b.categoryName}`}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteSingleTarget(b)}
                            title="Xóa ngân sách"
                            aria-label={`Xóa ngân sách ${b.categoryName}`}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">
                        Đã chi: <span className="text-foreground font-semibold">{formatCurrency(b.spent)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Hạn mức: <span className="text-foreground font-semibold">{formatCurrency(b.limit)}</span>
                      </span>
                    </div>
                    {hasRollover && (
                      <div className="text-[11px] text-muted-foreground mb-2 flex justify-end">
                        <span>
                          (Gốc: {formatCurrency(b.baseLimit ?? b.limit)} + Dư T{b.prevMonth}: {formatCurrency(b.rolloverAmount!)})
                        </span>
                      </div>
                    )}

                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.min(b.percent, 100)}%`,
                          backgroundColor: progressColor,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Còn lại:{" "}
                        <strong className={b.limit - b.spent >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {formatCurrency(b.limit - b.spent)}
                        </strong>
                      </span>
                      <span className="font-bold" style={{ color: progressColor }}>
                        {formatMetric(b.percent)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Upsert Budget Form */}
      <div
        ref={formRef}
        className="card bg-gradient-to-br from-orange-50/40 to-white border-orange-200/60"
      >
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Plus size={16} className="text-orange-600" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Thiết lập / Cập nhật ngân sách{" "}
              {isMonthAll ? `cho năm ${filterYear}` : `cho ${filterLabel.toLowerCase()}`}
            </h2>
          </div>
          {selectedCatId && (
            <button
              type="button"
              onClick={() => {
                setSelectedCatId("");
                setLimitVal("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              Đặt lại form
            </button>
          )}
        </div>

        <form onSubmit={handleUpsertSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {isMonthAll ? (
            <div>
              <label className="form-label form-label-required">Tháng áp dụng</label>
              <select
                name="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
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
            <input type="hidden" name="month" value={filterMonth} />
          )}
          <input type="hidden" name="year" value={filterYear} />

          <div>
            <label className="form-label form-label-required">Danh mục</label>
            <select
              name="categoryId"
              value={selectedCatId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="form-input"
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

          <div>
            <label className="form-label form-label-required">Hạn mức gốc (₫)</label>
            <SmartCurrencyInput
              name="limitAmount"
              value={limitVal}
              onChangeValue={(val) => setLimitVal(val)}
              placeholder="VD: 5.000.000"
              className="form-input"
              showQuickButtons
              showWordsPreview
              required
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn-primary py-2.5 px-6 cursor-pointer disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 size={16} className="mr-1.5 animate-spin" />
            ) : (
              <PiggyBank size={16} className="mr-1.5" />
            )}
            {isPending ? "Đang lưu..." : "Lưu ngân sách"}
          </button>
        </form>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        itemName="ngân sách"
        onClearSelection={() => setSelectedIds(new Set())}
        onConfirmDelete={async () => {
          const res = await deleteBudgets(Array.from(selectedIds));
          if ((res as any)?.error) {
            toast.error((res as any).error);
          } else {
            toast.success(`Đã xóa thành công ${res.count ?? selectedIds.size} ngân sách`);
            setSelectedIds(new Set());
          }
        }}
      />

      {/* Delete Single Budget Dialog */}
      <AlertDialog open={!!deleteSingleTarget} onOpenChange={(open) => !open && setDeleteSingleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">Xác nhận xóa ngân sách</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa ngân sách cho danh mục &ldquo;{deleteSingleTarget?.categoryName}&rdquo;? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteSingleTarget(null)}>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={async () => {
                if (deleteSingleTarget) {
                  await deleteBudget(deleteSingleTarget.id);
                  toast.success("Đã xóa ngân sách thành công");
                  setDeleteSingleTarget(null);
                }
              }}
            >
              Xóa ngân sách
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
