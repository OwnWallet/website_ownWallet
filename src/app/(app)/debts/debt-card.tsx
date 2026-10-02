"use client";

import { useState } from "react";
import { Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, calcPercent, toDate } from "@/lib/utils";
import { deleteDebt } from "@/actions/debts";
import { DebtActions } from "./debt-actions";
import { DebtLogModal } from "./debt-log-modal";
import { DebtCalculatorModal } from "./debt-calculator-modal";
import { DebtEditModal } from "./debt-edit-modal";
import { parseDebtMetadata } from "@/lib/debt-schedule";
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

  const meta = parseDebtMetadata(debt.note);
  const schedule = meta.schedule;

  let statusColor = "var(--muted-foreground)";
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
              {meta.cleanNote && <p className="text-xs text-muted mt-0.5">{meta.cleanNote}</p>}
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
            <DebtEditModal debt={debt} />
            <DebtLogModal debtId={debt.id} debtPerson={debt.person} debtAmount={amount} debtPaidAmount={paid} />
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

        {/* Schedule & Interest Tag */}
        {(schedule?.hasInterest || schedule?.isMonthly) && (
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-orange-800 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 px-2.5 py-1 rounded-lg w-fit">
            <span>🧮</span>
            {schedule.hasInterest && (
              <span>Lãi {schedule.rate}%/{schedule.rateType === "month" ? "tháng" : "năm"}</span>
            )}
            {schedule.hasInterest && schedule.isMonthly && <span>·</span>}
            {schedule.isMonthly && (
              <span>{schedule.months} tháng ({schedule.method === "linear" ? "Dư nợ giảm" : "Góp đều"})</span>
            )}
          </div>
        )}

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

        <div className="flex flex-wrap justify-between items-center gap-2 mt-1">
          <div className="text-xs">
            {debt.dueDate ? (
              <span style={{ color: isOverdue ? "var(--color-expense)" : "var(--foreground-subtle)" }}>
                Hạn: {formatDate(debt.dueDate)} {isOverdue && "⚠️ Quá hạn"}
              </span>
            ) : (
              <span className="text-muted text-xs">Không có hạn</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Nút xem lịch trả nợ */}
            <DebtCalculatorModal
              debt={debt}
              trigger={
                <button
                  type="button"
                  title="Xem lịch trả nợ & tính lãi chi tiết"
                  className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center gap-1.5 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 active:scale-95"
                >
                  <Calculator size={12} />
                  <span>{debt.direction === "OWE" ? "Lịch trả nợ" : "Lịch thu nợ"}</span>
                </button>
              }
            />

            {debt.status !== "PAID" && (
              <DebtActions debtId={debt.id} debt={debt} wallets={wallets} inline mode="record" />
            )}
          </div>
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
