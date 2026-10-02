"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateDebt } from "@/actions/debts";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";
import { formatCurrency, toDate } from "@/lib/utils";
import {
  parseDebtMetadata,
  encodeDebtMetadata,
  calculateDebtAmortization,
} from "@/lib/debt-schedule";
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

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function DebtEditModal({
  debt,
  trigger,
}: {
  debt: any;
  trigger?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Parse existing data
  const meta = parseDebtMetadata(debt.note);
  const initialSchedule = meta.schedule;

  const [person, setPerson] = useState(debt.person || "");
  const [direction, setDirection] = useState<"OWE" | "OWED">(debt.direction || "OWE");
  const [priority, setPriority] = useState<"HIGH" | "NORMAL" | "LOW">(debt.priority || "NORMAL");
  const [amountVal, setAmountVal] = useState<number>(Number(debt.amount) || 0);

  const [hasDueDate, setHasDueDate] = useState<boolean>(!!debt.dueDate);
  const [dueDateVal, setDueDateVal] = useState<string>(
    debt.dueDate ? toDate(debt.dueDate).toISOString().slice(0, 10) : ""
  );

  const [hasInterest, setHasInterest] = useState<boolean>(!!initialSchedule?.hasInterest);
  const [interestRate, setInterestRate] = useState<number>(initialSchedule?.rate ?? 12);
  const [rateType, setRateType] = useState<"year" | "month">(initialSchedule?.rateType || "year");
  const [interestMethod, setInterestMethod] = useState<"annuity" | "linear">(
    initialSchedule?.method || "annuity"
  );
  const [isMonthly, setIsMonthly] = useState<boolean>(!!initialSchedule?.isMonthly);
  const [termMonths, setTermMonths] = useState<number>(initialSchedule?.months || 12);

  const [cleanNote, setCleanNote] = useState<string>(meta.cleanNote || "");

  const mounted = useMounted();
  const [confirmReduceOpen, setConfirmReduceOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  // Reset form when debt changes or modal opens
  const handleOpen = () => {
    const freshMeta = parseDebtMetadata(debt.note);
    const sched = freshMeta.schedule;

    setPerson(debt.person || "");
    setDirection(debt.direction || "OWE");
    setPriority(debt.priority || "NORMAL");
    setAmountVal(Number(debt.amount) || 0);

    setHasDueDate(!!debt.dueDate);
    setDueDateVal(debt.dueDate ? toDate(debt.dueDate).toISOString().slice(0, 10) : "");

    setHasInterest(!!sched?.hasInterest);
    setInterestRate(sched?.rate ?? 12);
    setRateType(sched?.rateType || "year");
    setInterestMethod(sched?.method || "annuity");
    setIsMonthly(!!sched?.isMonthly);
    setTermMonths(sched?.months || 12);

    setCleanNote(freshMeta.cleanNote || "");
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const { monthlyPayment: calculatedMonthlyPayment, totalInterest: calculatedTotalInterest } =
    calculateDebtAmortization(
      amountVal,
      hasInterest ? interestRate : 0,
      rateType,
      termMonths,
      interestMethod
    );

  const paidAmount = Number(debt.paidAmount || 0);
  const remainAfterEdit = Math.max(0, amountVal - paidAmount);

  return (
    <>
      {trigger ? (
        <span onClick={handleOpen}>{trigger}</span>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          title="Chỉnh sửa khoản nợ"
          aria-label="Chỉnh sửa khoản nợ"
          className="p-1 rounded text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <Pencil size={13} />
        </button>
      )}

      {mounted && isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-card border border-border shadow-2xl rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-debt-title"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 id="edit-debt-title" className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                  <Pencil size={18} className="text-primary" />
                  <span>Chỉnh sửa khoản nợ</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cập nhật thông tin chi tiết của khoản {direction === "OWE" ? "vay" : "cho vay"}
                </p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Thông tin đối soát nhanh */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-border text-xs flex justify-between items-center">
              <div>
                <span className="text-muted-foreground block text-[11px]">Đã thanh toán trước đó:</span>
                <span className="font-bold text-emerald-600 text-xs sm:text-sm">{formatCurrency(paidAmount)}</span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-[11px]">Còn lại sau khi sửa:</span>
                <span className="font-bold text-rose-600 text-xs sm:text-sm">{formatCurrency(remainAfterEdit)}</span>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (loading) return;

                const trimmedPerson = person.trim();
                if (!trimmedPerson) {
                  toast.warning("Vui lòng nhập tên người / đối tác");
                  return;
                }

                if (!amountVal || amountVal <= 0) {
                  toast.warning("Vui lòng nhập số tiền hợp lệ lớn hơn 0");
                  return;
                }

                // Tạo FormData trước (dùng cho cả confirm dialog và submit thông thường)
                const fd = new FormData();
                fd.set("person", trimmedPerson);
                fd.set("amount", String(amountVal));
                fd.set("direction", direction);
                fd.set("priority", priority);

                if (hasDueDate && dueDateVal) {
                  fd.set("dueDate", dueDateVal);
                }

                // Đóng gói cấu hình lãi suất và kỳ hạn vào note
                const encodedNote = encodeDebtMetadata(cleanNote, {
                  hasInterest,
                  rate: hasInterest ? interestRate : 0,
                  rateType,
                  isMonthly,
                  months: isMonthly ? termMonths : undefined,
                  method: interestMethod,
                  startDate: hasDueDate && dueDateVal ? dueDateVal : undefined,
                });
                fd.set("note", encodedNote);

                if (amountVal < paidAmount) {
                  // Lưu form data và hiện AlertDialog thay vì window.confirm()
                  setPendingFormData(fd);
                  setConfirmReduceOpen(true);
                  return;
                }

                setLoading(true);
                try {
                  const res: any = await updateDebt(debt.id, fd);
                  if (res?.error) {
                    toast.error("Không thể cập nhật khoản nợ. Vui lòng thử lại.");
                  } else {
                    toast.success(`Đã cập nhật khoản nợ với ${trimmedPerson} thành công!`);
                    setIsOpen(false);
                  }
                } catch (err: any) {
                  console.error(err);
                  toast.error(err?.message || "Lỗi khi cập nhật khoản nợ");
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-4"
            >
              {/* Loại nợ & Mức ưu tiên */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Loại khoản nợ
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as "OWE" | "OWED")}
                    disabled={loading}
                    className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="OWE">Tôi đi vay (Nợ phải trả)</option>
                    <option value="OWED">Cho vay (Nợ phải thu)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Mức độ ưu tiên
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    disabled={loading}
                    className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="HIGH">🔴 Cao (Cần xử lý sớm)</option>
                    <option value="NORMAL">🟡 Bình thường</option>
                    <option value="LOW">🟢 Thấp (Chưa gấp)</option>
                  </select>
                </div>
              </div>

              {/* Tên đối tác */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Tên người / Đối tác
                </label>
                <input
                  type="text"
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              {/* Số tiền gốc */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Số tiền gốc (₫)
                </label>
                <SmartCurrencyInput
                  name="amount"
                  value={amountVal}
                  required
                  min={1000}
                  disabled={loading}
                  placeholder="VD: 1,000,000"
                  showQuickButtons={true}
                  showWordsPreview={true}
                  onChangeValue={(val) => setAmountVal(val)}
                />
              </div>

              {/* Ngày đến hạn */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-foreground block">
                      Thời hạn trả nợ
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Khoản nợ này có ngày đáo hạn cụ thể hay không?
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDueDate}
                      disabled={loading}
                      onChange={(e) => setHasDueDate(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {hasDueDate && (
                  <div className="pt-2 animate-fade-in">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Ngày đến hạn
                    </label>
                    <input
                      type="date"
                      value={dueDateVal}
                      onChange={(e) => setDueDateVal(e.target.value)}
                      required={hasDueDate}
                      disabled={loading}
                      className="w-full sm:w-64 bg-background rounded-xl px-3.5 py-2 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* Cấu hình Lãi suất & Trả góp */}
              <div className="p-3.5 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <span>🧮</span>
                      <span>Tính lãi suất & Lịch trả theo từng tháng</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Áp dụng tính tiền lãi và lập lịch trả nợ/thu nợ định kỳ
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-orange-200/50">
                  {/* Switch Lãi suất */}
                  <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Có tính lãi suất?</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasInterest}
                          disabled={loading}
                          onChange={(e) => setHasInterest(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>

                    {hasInterest && (
                      <div className="space-y-2 pt-1 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={interestRate}
                            onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
                            placeholder="12"
                            className="w-24 bg-background rounded-lg px-2.5 py-1.5 text-sm border border-slate-200 focus:border-orange-500 focus:outline-none"
                          />
                          <select
                            value={rateType}
                            onChange={(e) => setRateType(e.target.value as any)}
                            className="bg-background rounded-lg px-2.5 py-1.5 text-xs border border-slate-200 focus:border-orange-500 focus:outline-none"
                          >
                            <option value="year">%/năm</option>
                            <option value="month">%/tháng</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] text-muted-foreground mb-1">Phương thức:</label>
                          <select
                            value={interestMethod}
                            onChange={(e) => setInterestMethod(e.target.value as any)}
                            className="w-full bg-background rounded-lg px-2.5 py-1.5 text-xs border border-slate-200 focus:border-orange-500 focus:outline-none"
                          >
                            <option value="annuity">Trả góp đều hàng tháng (Annuity)</option>
                            <option value="linear">Dư nợ giảm dần (Linear)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Switch Trả theo từng tháng */}
                  <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Trả theo từng tháng?</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isMonthly}
                          disabled={loading}
                          onChange={(e) => setIsMonthly(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>

                    {isMonthly && (
                      <div className="space-y-2 pt-1 animate-fade-in">
                        <div>
                          <label className="block text-[11px] text-muted-foreground mb-1">Kỳ hạn (Số tháng):</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="360"
                              value={termMonths}
                              onChange={(e) => setTermMonths(Math.max(1, Number(e.target.value) || 12))}
                              className="w-24 bg-background rounded-lg px-2.5 py-1.5 text-sm border border-slate-200 focus:border-orange-500 focus:outline-none"
                            />
                            <span className="text-xs text-muted-foreground">tháng</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dự toán nhanh */}
                {(hasInterest || isMonthly) && amountVal > 0 && (
                  <div className="p-2.5 rounded-lg bg-orange-100/70 dark:bg-orange-900/30 text-xs text-orange-950 dark:text-orange-200 flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                    <span>
                      💡 Dự kiến trả: <strong>{formatCurrency(calculatedMonthlyPayment)}</strong> /tháng
                    </span>
                    {hasInterest && (
                      <span>
                        Tổng lãi: <strong>{formatCurrency(calculatedTotalInterest)}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Mô tả / Ghi chú mục đích (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={cleanNote}
                  onChange={(e) => setCleanNote(e.target.value)}
                  disabled={loading}
                  placeholder="VD: Vay mua xe, mượn tiền kinh doanh, cho bạn bè vay..."
                  className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-orange-500"
                />
              </div>

              {/* Nút hành động */}
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer shadow-sm transition-all"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                    opacity: loading ? 0.6 : 1,
                    pointerEvents: loading ? "none" : "auto",
                  }}
                >
                  {loading ? "Đang lưu..." : "Cập nhật khoản nợ"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* AlertDialog xác nhận giảm số tiền xuống dưới số đã trả */}
      <AlertDialog open={confirmReduceOpen} onOpenChange={(o) => { if (!o) { setConfirmReduceOpen(false); setPendingFormData(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận giảm số tiền gốc</AlertDialogTitle>
            <AlertDialogDescription>
              Số tiền mới ({formatCurrency(amountVal)}) nhỏ hơn số tiền đã trả ({formatCurrency(paidAmount)}).
              Khoản nợ sẽ được đánh dấu là <strong>HOÀN TẤT</strong>. Bạn có chắc chắn không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmReduceOpen(false); setPendingFormData(null); }}>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmReduceOpen(false);
                if (!pendingFormData) return;
                setLoading(true);
                try {
                  const res: any = await updateDebt(debt.id, pendingFormData);
                  if (res?.error) {
                    toast.error("Không thể cập nhật khoản nợ. Vui lòng thử lại.");
                  } else {
                    toast.success(`Đã cập nhật khoản nợ với ${pendingFormData.get("person")} thành công!`);
                    setIsOpen(false);
                  }
                } catch (err: any) {
                  toast.error(err?.message || "Lỗi khi cập nhật khoản nợ");
                } finally {
                  setLoading(false);
                  setPendingFormData(null);
                }
              }}
            >
              Xác nhận cập nhật
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
