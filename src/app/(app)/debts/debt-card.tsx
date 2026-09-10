"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, calcPercent, toDate } from "@/lib/utils";
import { deleteDebt } from "@/actions/debts";
import { DebtActions } from "./debt-actions";
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

export function DebtCard({
  debt,
  wallets = [],
  selected,
  onToggleSelect,
}: {
  debt: any;
  wallets?: any[];
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const amount = Number(debt.amount);
  const paid = Number(debt.paidAmount);
  const remain = Math.max(0, amount - paid);
  const percent = calcPercent(paid, amount);

  let statusColor = "var(--foreground-muted)";
  let statusText = "Chờ trả";
  if (debt.status === "PAID") {
    statusColor = "var(--color-income)";
    statusText = "Đã xong";
  } else if (debt.status === "PARTIAL") {
    statusColor = "var(--color-debt)";
    statusText = "Trả 1 phần";
  }

  const isOverdue = debt.dueDate && toDate(debt.dueDate) < new Date() && debt.status !== "PAID";

  return (
    <>
      <div className={`card relative flex flex-col gap-3 group transition-colors ${selected ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2.5">
            {onToggleSelect && (
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary/30 cursor-pointer accent-primary shrink-0"
                checked={!!selected}
                onChange={onToggleSelect}
                title="Chọn khoản nợ này"
              />
            )}
            <div>
              <h3 className="font-bold text-base">{debt.person}</h3>
              {debt.note && <p className="text-xs text-muted mt-0.5">{debt.note}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {debt.priority === "HIGH" ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs">
                🔴 Ưu tiên cao
              </span>
            ) : debt.priority === "LOW" ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                🟢 Ưu tiên thấp
              </span>
            ) : null}
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
                color: statusColor,
                border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
              }}
            >
              {statusText}
            </span>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              title="Xóa khoản nợ"
              aria-label="Xóa khoản nợ"
              className="p-1 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-baseline text-xs">
          <span className="text-muted-foreground">
            Tổng: <strong className="text-foreground text-sm font-bold">{formatCurrency(amount)}</strong>
          </span>
          <span className="text-muted-foreground">
            Còn lại:{" "}
            <strong className="text-sm font-extrabold" style={{ color: debt.direction === "OWE" ? "var(--color-expense)" : "var(--color-income)" }}>
              {formatCurrency(remain)}
            </strong>
          </span>
        </div>

        <div className="h-2 w-full bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${percent}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>

        <div className="flex justify-between items-center mt-1">
          <div className="text-xs">
            {debt.dueDate ? (
              <span style={{ color: isOverdue ? "var(--color-expense)" : "var(--foreground-subtle)" }}>
                Hạn: {formatDate(debt.dueDate)} {isOverdue && "⚠️ Quá hạn"}
              </span>
            ) : (
              <span className="text-muted text-xs">Không có hạn</span>
            )}
          </div>

          {debt.status !== "PAID" && (
            <DebtActions debtId={debt.id} debt={debt} wallets={wallets} inline mode="record" />
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa khoản nợ</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa khoản nợ với &ldquo;{debt.person}&rdquo;? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Hủy bỏ
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteDebt(debt.id);
                toast.success("Đã xóa khoản nợ thành công");
                setShowDeleteDialog(false);
              }}
            >
              Xóa khoản nợ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
