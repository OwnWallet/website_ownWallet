"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { BUDGET_WARNING_THRESHOLD, BUDGET_DANGER_THRESHOLD } from "@/lib/constants";
import { deleteBudget, deleteBudgets } from "@/actions/budgets";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
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
  month: number;
  year: number;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string;
  limit: number;
  spent: number;
  percent: number;
}

interface BudgetListClientProps {
  budgets: BudgetItemData[];
  isMonthAll: boolean;
  filterLabel: string;
}

export function BudgetListClient({
  budgets,
  isMonthAll,
  filterLabel,
}: BudgetListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteSingleTarget, setDeleteSingleTarget] = useState<BudgetItemData | null>(null);

  if (budgets.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">💸</span>
        <h3 className="empty-state-title">Chưa có ngân sách cho {filterLabel.toLowerCase()}</h3>
        <p className="empty-state-desc">Hãy thiết lập ngân sách bên dưới để bắt đầu theo dõi chi tiêu.</p>
      </div>
    );
  }

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
    <div className="space-y-4">
      {/* Selection toolbar */}
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary/30 cursor-pointer accent-primary shrink-0"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(b.id)}
                    title="Chọn ngân sách này"
                  />
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border shrink-0"
                    style={{
                      backgroundColor: `${b.categoryColor || "#ea580c"}12`,
                      borderColor: `${b.categoryColor || "#ea580c"}30`,
                    }}
                  >
                    {b.categoryIcon || "📂"}
                  </div>
                  <div>
                    <span className="font-bold text-base block truncate">{b.categoryName}</span>
                    {isMonthAll && (
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
                  <button
                    type="button"
                    onClick={() => setDeleteSingleTarget(b)}
                    title="Xóa ngân sách"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    Đã chi: <span className="text-foreground font-semibold">{formatCurrency(b.spent)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Hạn mức: <span className="text-foreground font-semibold">{formatCurrency(b.limit)}</span>
                  </span>
                </div>

                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.min(b.percent, 100)}%`,
                      backgroundColor: progressColor,
                    }}
                  />
                </div>
                <div className="mt-2 text-right">
                  <span className="text-xs font-bold" style={{ color: progressColor }}>
                    {b.percent}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
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
