"use client";

import { useState, useTransition } from "react";
import { createDebt, recordPayment, mergeDebt } from "@/actions/debts";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

export function DebtActions({
  debtId,
  mode = "add",
  wallets = [],
  existingDebts = [],
}: {
  debtId?: string;
  inline?: boolean;
  mode?: "add" | "record";
  wallets?: { id: string; name: string; balance: string | number | { toString: () => string } }[];
  existingDebts?: any[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasDueDate, setHasDueDate] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    match: any;
    fd: FormData;
    newAmount: number;
    person: string;
    direction: "OWE" | "OWED";
  } | null>(null);

  const isBusy = loading || isPending;

  if (mode === "record") {
    if (!isOpen) {
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="text-xs px-3 py-1.5 rounded transition-colors cursor-pointer"
          style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-strong)" }}
        >
          Ghi nhận trả
        </button>
      );
    }

    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (isBusy) return;
          setLoading(true);
          try {
            const fd = new FormData(e.currentTarget);
            await recordPayment(debtId!, fd);
            setIsOpen(false);
          } finally {
            setLoading(false);
          }
        }}
        className="flex flex-wrap gap-2 items-center"
      >
        <div className="w-36">
          <SmartCurrencyInput
            name="paidAmount"
            placeholder="Số tiền..."
            required
            min={1}
            disabled={isBusy}
            showQuickButtons={false}
          />
        </div>
        {wallets.length > 0 && (
          <select
            name="walletId"
            disabled={isBusy}
            className="text-xs bg-background rounded-xl px-2.5 py-2 text-foreground focus:outline-none border border-slate-200"
          >
            <option value="">-- Không qua ví --</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={isBusy}
          className="text-xs px-3.5 py-2 rounded-xl font-medium cursor-pointer transition-opacity"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
            opacity: isBusy ? 0.6 : 1,
            pointerEvents: isBusy ? "none" : "auto",
          }}
        >
          {isBusy ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setIsOpen(false)}
          className="text-xs px-2.5 py-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Hủy
        </button>
      </form>
    );
  }

  // mode === "add"
  return (
    <div className="mt-8">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2.5 rounded-xl font-semibold transition-colors cursor-pointer shadow-sm hover:opacity-95"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          + Thêm khoản nợ mới
        </button>
      ) : (
        <div
          className="card bg-card border border-border shadow-md rounded-2xl p-5 sm:p-6 animate-fade-in"
        >
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-border">
            <h3 className="font-bold text-lg text-foreground">Thêm khoản nợ mới</h3>
            <button
              disabled={isBusy}
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (isBusy) return;

              const fd = new FormData(e.currentTarget);
              if (!hasDueDate) {
                fd.delete("dueDate");
              }

              const person = fd.get("person")?.toString()?.trim() || "";
              const direction = (fd.get("direction")?.toString() || "OWE") as "OWE" | "OWED";
              const amount = Number(fd.get("amount") || 0);

              // Kiểm tra xem đã có khoản nợ/vay cùng tên và cùng chiều chưa
              const match = existingDebts.find(
                (d) =>
                  d.person?.trim().toLowerCase() === person.toLowerCase() &&
                  d.direction === direction &&
                  d.status !== "PAID"
              );

              if (match) {
                // Hiển thị modal hỏi người dùng có muốn gộp nợ không
                setDuplicatePrompt({
                  match,
                  fd,
                  newAmount: amount,
                  person,
                  direction,
                });
                return;
              }

              setLoading(true);
              try {
                const res: any = await createDebt(fd);
                if (res?.error) {
                  toast.error("Không thể tạo khoản nợ. Vui lòng kiểm tra lại thông tin.");
                } else {
                  toast.success(`Đã thêm khoản nợ với ${person} thành công!`);
                  setIsOpen(false);
                }
              } catch (err) {
                console.error(err);
                toast.error("Đã có lỗi xảy ra khi lưu khoản nợ");
              } finally {
                setLoading(false);
              }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Loại khoản nợ
              </label>
              <select
                name="direction"
                required
                disabled={isBusy}
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
                name="priority"
                defaultValue="NORMAL"
                disabled={isBusy}
                className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="HIGH">🔴 Cao (Cần xử lý sớm)</option>
                <option value="NORMAL">🟡 Bình thường</option>
                <option value="LOW">🟢 Thấp (Chưa gấp)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Tên người / Đối tác
              </label>
              <input
                type="text"
                name="person"
                required
                disabled={isBusy}
                placeholder="VD: Nguyễn Văn A"
                className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Số tiền (₫)
              </label>
              <SmartCurrencyInput
                name="amount"
                required
                min={1000}
                disabled={isBusy}
                placeholder="VD: 1,000,000"
                showQuickButtons={true}
              />
            </div>

            {/* Có thời hạn hay không */}
            <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
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
                    disabled={isBusy}
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
                    name="dueDate"
                    required={hasDueDate}
                    disabled={isBusy}
                    className="w-full sm:w-64 bg-background rounded-xl px-3.5 py-2 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-orange-500"
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Ghi chú (Tùy chọn)
              </label>
              <input
                type="text"
                name="note"
                disabled={isBusy}
                placeholder="Ghi chú thêm mục đích vay, lãi suất..."
                className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-orange-500"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 mt-3 pt-3 border-t border-border">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setIsOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer shadow-sm transition-all"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                  opacity: isBusy ? 0.6 : 1,
                  pointerEvents: isBusy ? "none" : "auto",
                }}
              >
                {isBusy ? "Đang lưu..." : "Lưu khoản nợ"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Dialog hỏi gộp nợ khi phát hiện trùng tên */}
      {duplicatePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card border border-border shadow-2xl rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-scale-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 text-xl font-bold">
                ⚠️
              </div>
              <div>
                <h4 className="font-bold text-base text-foreground">
                  Phát hiện nợ trùng với &quot;{duplicatePrompt.person}&quot;
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bạn đã có khoản {duplicatePrompt.direction === "OWE" ? "nợ phải trả" : "cho vay"} với người này từ trước.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Khoản nợ hiện có:</span>
                <span className="font-bold text-foreground">{formatCurrency(Number(duplicatePrompt.match.amount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Đã thanh toán:</span>
                <span className="text-emerald-600">{formatCurrency(Number(duplicatePrompt.match.paidAmount))}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <span className="text-muted-foreground">Còn lại chưa thanh toán:</span>
                <span className="text-rose-600 font-bold">
                  {formatCurrency(Number(duplicatePrompt.match.amount) - Number(duplicatePrompt.match.paidAmount))}
                </span>
              </div>
              <div className="flex justify-between border-t border-dashed border-border pt-1">
                <span className="text-muted-foreground">Khoản mới muốn thêm:</span>
                <span className="font-bold text-primary">+{formatCurrency(duplicatePrompt.newAmount)}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Bạn có muốn <strong>gộp số tiền này vào khoản nợ cũ</strong> (tổng nợ sau gộp sẽ là{" "}
              <strong className="text-foreground">
                {formatCurrency(Number(duplicatePrompt.match.amount) + duplicatePrompt.newAmount)}
              </strong>
              ) hay muốn tạo thành một <strong>khoản nợ riêng biệt</strong>?
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const note = duplicatePrompt.fd.get("note")?.toString();
                    const res: any = await mergeDebt(duplicatePrompt.match.id, duplicatePrompt.newAmount, note);
                    if (res?.error) {
                      toast.error(res.error);
                    } else {
                      toast.success(
                        `Đã gộp ${formatCurrency(duplicatePrompt.newAmount)} vào khoản nợ với ${duplicatePrompt.person}! Tổng nợ mới: ${formatCurrency(res.newAmount)}`
                      );
                      setDuplicatePrompt(null);
                      setIsOpen(false);
                    }
                  } catch (err: any) {
                    toast.error(err?.message || "Lỗi khi gộp nợ");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="btn-primary py-2.5 px-4 text-xs font-bold rounded-xl flex-1 text-center cursor-pointer shadow-sm"
              >
                {loading ? "Đang gộp..." : "Gộp vào nợ cũ"}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res: any = await createDebt(duplicatePrompt.fd);
                    if (res?.error) {
                      toast.error("Không thể tạo khoản nợ");
                    } else {
                      toast.success(`Đã tạo khoản nợ riêng biệt với ${duplicatePrompt.person}`);
                      setDuplicatePrompt(null);
                      setIsOpen(false);
                    }
                  } catch (err: any) {
                    toast.error(err?.message || "Lỗi khi tạo nợ");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-foreground py-2.5 px-3 text-xs font-semibold rounded-xl flex-1 text-center transition-colors cursor-pointer border border-border"
              >
                Tạo nợ riêng
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => setDuplicatePrompt(null)}
                className="py-2.5 px-3 text-xs text-muted-foreground hover:text-foreground text-center cursor-pointer rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
