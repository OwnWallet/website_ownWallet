"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  Edit2,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Wallet as WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency, formatDate, formatMetric } from "@/lib/utils";
import { getInstallmentMonthlyAmount, getUtilizationLevel, WALLET_KIND_EMOJI, getWalletKind } from "@/lib/credit-card";
import { payCreditCard } from "@/actions/wallets";
import {
  createInstallment,
  deleteInstallment,
  getInstallmentCandidates,
  getInstallments,
} from "@/actions/credit-cards";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FitAmount } from "@/components/ui/fit-amount";

export interface CreditInfo {
  creditLimit: number;
  creditDebt: number;
  availableCredit: number;
  utilization: number;
  activeInstallmentCount: number;
  installmentRemaining: number;
  statement: {
    lastStatementDate: string;
    nextStatementDate: string;
    dueDate: string;
    daysUntilDue: number;
    daysUntilNextStatement: number;
    statementAmount: number;
    paidSinceStatement: number;
    remainingDue: number;
    installmentDueThisStatement: number;
    status: "NO_DUE" | "PAID" | "DUE" | "DUE_SOON" | "OVERDUE";
  };
}

export interface CardWallet {
  id: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  balance: number;
  currentBalance: number;
  type?: string | null;
  expense: number;
  txCount: number;
  isDefault: boolean;
  credit: CreditInfo | null;
}

export interface SourceWallet {
  id: string;
  name: string;
  bankName: string | null;
  type?: string | null;
  currentBalance: number;
}

interface CreditCardSectionProps {
  cards: CardWallet[];
  sources: SourceWallet[];
  onAdd: () => void;
  onEdit: (card: CardWallet) => void;
  onDelete: (id: string) => void;
}

const UTIL_COLORS = {
  low: { bar: "bg-emerald-500", text: "text-emerald-600" },
  medium: { bar: "bg-amber-500", text: "text-amber-600" },
  high: { bar: "bg-rose-500", text: "text-rose-600" },
};

function dueLabel(s: CreditInfo["statement"]): { text: string; cls: string } {
  switch (s.status) {
    case "NO_DUE":
      return { text: "Kỳ này không có dư nợ", cls: "bg-slate-100 text-slate-600 border-slate-200" };
    case "PAID":
      return { text: "Đã thanh toán đủ", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "OVERDUE":
      return { text: `Quá hạn ${Math.abs(s.daysUntilDue)} ngày`, cls: "bg-rose-50 text-rose-700 border-rose-200" };
    case "DUE_SOON":
      return {
        text: s.daysUntilDue === 0 ? "Đến hạn hôm nay" : `Còn ${s.daysUntilDue} ngày`,
        cls: "bg-amber-50 text-amber-800 border-amber-200",
      };
    default:
      return { text: `Còn ${s.daysUntilDue} ngày`, cls: "bg-sky-50 text-sky-700 border-sky-200" };
  }
}

export function CreditCardSection({ cards, sources, onAdd, onEdit, onDelete }: CreditCardSectionProps) {
  const [payingCard, setPayingCard] = useState<CardWallet | null>(null);
  const [installmentCard, setInstallmentCard] = useState<CardWallet | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="text-indigo-600" size={20} />
            <span>Thẻ tín dụng</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi hạn mức, kỳ sao kê, hạn thanh toán và các khoản trả góp. Dư nợ thẻ được tính là khoản nợ, không cộng vào số dư.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 text-xs font-bold shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus size={14} /> Thêm thẻ tín dụng
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted-foreground">
          Chưa có thẻ tín dụng nào. Thêm thẻ để theo dõi dư nợ và nhắc hạn thanh toán.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.map((card) => (
            <CreditCardItem
              key={card.id}
              card={card}
              onPay={() => setPayingCard(card)}
              onInstallments={() => setInstallmentCard(card)}
              onEdit={() => onEdit(card)}
              onDelete={() => onDelete(card.id)}
            />
          ))}
        </div>
      )}

      <PayCardDialog card={payingCard} sources={sources} onClose={() => setPayingCard(null)} />
      <InstallmentDialog card={installmentCard} onClose={() => setInstallmentCard(null)} />
    </section>
  );
}

function CreditCardItem({
  card,
  onPay,
  onInstallments,
  onEdit,
  onDelete,
}: {
  card: CardWallet;
  onPay: () => void;
  onInstallments: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const credit = card.credit;
  if (!credit) return null;
  const level = getUtilizationLevel(credit.utilization);
  const s = credit.statement;
  const badge = dueLabel(s);

  return (
    <div className="card overflow-hidden border border-border/80 shadow-xs hover:shadow-md transition-all flex flex-col">
      {/* Card face */}
      <div className="p-5 bg-gradient-to-br from-indigo-800 via-slate-900 to-zinc-950 text-white relative overflow-hidden rounded-t-xl min-h-[170px] flex flex-col justify-between">
        <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-12 -top-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <CreditCard size={20} className="text-white/90" />
            <span className="font-extrabold tracking-tight text-sm uppercase">{card.bankName || "Thẻ tín dụng"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-400/30 border border-indigo-200/30">
              Credit
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-white/15 text-white border-white/20 truncate max-w-[120px]">
              {card.name}
            </span>
          </div>
        </div>

        <div className="my-2 z-10 flex items-center justify-between">
          <div className="w-9 h-6 rounded-md bg-amber-300/80 border border-amber-400/50 flex flex-col justify-around p-0.5 shadow-xs">
            <div className="w-full h-0.5 bg-amber-600/40 rounded" />
            <div className="w-full h-0.5 bg-amber-600/40 rounded" />
          </div>
          <div className="font-mono text-xs tracking-widest text-white/80">
            •••• •••• •••• {card.accountNumber ? card.accountNumber.slice(-4) : "••••"}
          </div>
        </div>

        <div className="z-10 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] text-white/70 uppercase font-semibold tracking-wider block">Dư nợ hiện tại</span>
            <p className="text-xl md:text-2xl font-black tracking-tight mt-0.5 min-w-0">
              <FitAmount>{formatCurrency(credit.creditDebt)}</FitAmount>
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-white/70 uppercase font-semibold tracking-wider block">Hạn mức</span>
            <p className="text-sm font-bold text-white/90">{formatCurrency(credit.creditLimit)}</p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 bg-card flex-1 flex flex-col gap-3">
        {/* Utilization */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">
              Khả dụng:{" "}
              <span className={cn("font-bold", credit.availableCredit < 0 ? "text-rose-600" : "text-foreground")}>
                {formatCurrency(credit.availableCredit)}
              </span>
            </span>
            <span className={cn("font-bold tabular-nums", UTIL_COLORS[level].text)}>
              {formatMetric(credit.utilization)}% đã dùng
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", UTIL_COLORS[level].bar)}
              style={{ width: `${Math.min(100, credit.utilization)}%` }}
            />
          </div>
        </div>

        {/* Statement */}
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <CalendarClock size={13} className="text-indigo-600" />
              Sao kê {formatDate(s.lastStatementDate)}
            </span>
            <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold", badge.cls)}>{badge.text}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-muted-foreground block">Dư nợ sao kê</span>
              <span className="font-bold text-foreground">{formatCurrency(s.statementAmount)}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Còn phải trả</span>
              <span className={cn("font-bold", s.remainingDue > 0 ? "text-rose-600" : "text-emerald-600")}>
                {formatCurrency(s.remainingDue)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Hạn thanh toán</span>
              <span className="font-semibold text-foreground">{formatDate(s.dueDate)}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Chốt kỳ tới</span>
              <span className="font-semibold text-foreground">
                {formatDate(s.nextStatementDate)} ({s.daysUntilNextStatement} ngày)
              </span>
            </div>
          </div>
          {credit.activeInstallmentCount > 0 && (
            <div className="pt-1.5 border-t border-border/70 text-muted-foreground flex items-center gap-1.5">
              <Layers size={12} className="text-violet-600" />
              <span>
                {credit.activeInstallmentCount} khoản trả góp · còn{" "}
                <span className="font-semibold text-foreground">{formatCurrency(credit.installmentRemaining)}</span>
                {s.installmentDueThisStatement > 0 && <> · kỳ này {formatCurrency(s.installmentDueThisStatement)}</>}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPay}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <WalletIcon size={13} /> Thanh toán thẻ
          </button>
          <button
            type="button"
            onClick={onInstallments}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 text-xs font-bold transition-all cursor-pointer"
          >
            <Layers size={13} /> Trả góp
          </button>
        </div>

        <div className="flex items-center justify-between pt-1 gap-2 mt-auto">
          <Link
            href={`/transactions?wallet=${card.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-focus transition-colors"
          >
            <span>Lọc giao dịch ({card.txCount})</span>
            <ArrowRight size={13} />
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
              title="Chỉnh sửa thẻ"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Xóa thẻ"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Thanh toán thẻ ─────────────────────────────────────────────────────

function PayCardDialog({
  card,
  sources,
  onClose,
}: {
  card: CardWallet | null;
  sources: SourceWallet[];
  onClose: () => void;
}) {
  return (
    <Dialog open={!!card} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletIcon size={18} className="text-indigo-600" />
            <span>Thanh toán thẻ {card?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Trả nợ thẻ từ tài khoản ngân hàng hoặc ví tiền mặt. Khoản này được ghi như chuyển khoản nội bộ nên không bị tính trùng vào chi tiêu.
          </DialogDescription>
        </DialogHeader>

        {card?.credit && (
          <PayCardForm key={card.id} card={card} credit={card.credit} sources={sources} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayCardForm({
  card,
  credit,
  sources,
  onClose,
}: {
  card: CardWallet;
  credit: CreditInfo;
  sources: SourceWallet[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState<number | string>(
    credit.statement.remainingDue > 0 ? credit.statement.remainingDue : credit.creditDebt || ""
  );
  const [fromId, setFromId] = useState(sources[0]?.id || "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await payCreditCard(fd);
      if ("error" in res && res.error) {
        toast.error(String(res.error));
        return;
      }
      toast.success(`Đã thanh toán ${formatCurrency(Number(amount))} cho thẻ "${card.name}"!`);
      onClose();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <input type="hidden" name="toWalletId" value={card.id} />

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-border p-2.5">
          <span className="text-muted-foreground block text-[10px]">Còn phải trả kỳ này</span>
          <span className="font-bold text-rose-600">{formatCurrency(credit.statement.remainingDue)}</span>
        </div>
        <div className="rounded-xl border border-border p-2.5">
          <span className="text-muted-foreground block text-[10px]">Tổng dư nợ</span>
          <span className="font-bold text-foreground">{formatCurrency(credit.creditDebt)}</span>
        </div>
      </div>

      {sources.length === 0 ? (
        <p className="text-xs text-rose-600">
          Chưa có tài khoản ngân hàng hoặc ví tiền mặt để thanh toán. Hãy tạo một tài khoản trước.
        </p>
      ) : (
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Thanh toán từ *</label>
          <select
            name="fromWalletId"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="form-input"
            required
          >
            {sources.map((w) => (
              <option key={w.id} value={w.id}>
                {WALLET_KIND_EMOJI[getWalletKind(w)]} {w.name} ({formatCurrency(w.currentBalance)})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-foreground">Số tiền thanh toán (₫) *</label>
          <div className="flex gap-1">
            {credit.statement.remainingDue > 0 && (
              <button
                type="button"
                onClick={() => setAmount(credit.statement.remainingDue)}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border hover:bg-muted cursor-pointer"
              >
                Dư nợ kỳ này
              </button>
            )}
            {credit.creditDebt > 0 && (
              <button
                type="button"
                onClick={() => setAmount(credit.creditDebt)}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border hover:bg-muted cursor-pointer"
              >
                Toàn bộ dư nợ
              </button>
            )}
          </div>
        </div>
        <SmartCurrencyInput
          name="amount"
          value={amount}
          onChangeValue={(val) => setAmount(val)}
          className="form-input"
          showWordsPreview
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Phí (₫)</label>
          <SmartCurrencyInput name="fee" defaultValue={0} className="form-input" />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Ngày thanh toán</label>
          <input
            type="date"
            name="recordedAt"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="form-input"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-foreground block mb-1">Ghi chú (Tùy chọn)</label>
        <input type="text" name="note" placeholder="VD: Thanh toán sao kê tháng 11" className="form-input" />
      </div>

      <DialogFooter className="pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isPending || sources.length === 0 || !Number(amount)}
          className="btn-primary text-xs disabled:opacity-60"
        >
          {isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
          {isPending ? "Đang thanh toán..." : "Xác nhận thanh toán"}
        </button>
      </DialogFooter>
    </form>
  );
}

// ─── Trả góp ────────────────────────────────────────────────────────────

type InstallmentRow = Awaited<ReturnType<typeof getInstallments>>[number];
type CandidateRow = Awaited<ReturnType<typeof getInstallmentCandidates>>[number];

const MONTH_OPTIONS = [3, 6, 9, 12, 18, 24, 36];

function InstallmentDialog({ card, onClose }: { card: CardWallet | null; onClose: () => void }) {
  return (
    <Dialog open={!!card} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers size={18} className="text-violet-600" />
            <span>Trả góp qua thẻ {card?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Chuyển đổi giao dịch lớn thành trả góp nhiều kỳ. Mỗi kỳ sao kê chỉ tính phần trả góp đến hạn vào số tiền phải thanh toán.
          </DialogDescription>
        </DialogHeader>
        {card && <InstallmentPanel key={card.id} card={card} />}
      </DialogContent>
    </Dialog>
  );
}

function InstallmentPanel({ card }: { card: CardWallet }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [transactionId, setTransactionId] = useState("");
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState<number | string>("");
  const [months, setMonths] = useState(6);
  const [fee, setFee] = useState<number | string>(0);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  async function load(walletId: string) {
    try {
      const [r, c] = await Promise.all([getInstallments(walletId), getInstallmentCandidates(walletId)]);
      setRows(r);
      setCandidates(c);
    } catch {
      toast.error("Không tải được danh sách trả góp");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTransactionId("");
    setName("");
    setPrincipal("");
    setMonths(6);
    setFee(0);
    setStartDate(new Date().toISOString().slice(0, 10));
  }

  useEffect(() => {
    let alive = true;
    Promise.all([getInstallments(card.id), getInstallmentCandidates(card.id)])
      .then(([r, c]) => {
        if (!alive) return;
        setRows(r);
        setCandidates(c);
      })
      .catch(() => alive && toast.error("Không tải được danh sách trả góp"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [card.id]);

  function pickCandidate(id: string) {
    setTransactionId(id);
    const c = candidates.find((x) => x.id === id);
    if (c) {
      setPrincipal(c.amount);
      setName(c.note || "Trả góp");
      setStartDate(c.recordedAt.slice(0, 10));
    }
  }

  const monthly = useMemo(
    () => getInstallmentMonthlyAmount({ principal: Number(principal) || 0, months, feeAmount: Number(fee) || 0 }),
    [principal, months, fee]
  );

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createInstallment(fd);
      if ("error" in res && res.error) {
        toast.error(String(res.error));
        return;
      }
      toast.success("Đã tạo khoản trả góp!");
      setShowForm(false);
      resetForm();
      await load(card.id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteInstallment(id);
      if ("error" in res && res.error) {
        toast.error(String(res.error));
        return;
      }
      toast.success("Đã xóa khoản trả góp");
      setConfirmDeleteId(null);
      await load(card.id);
      router.refresh();
    });
  }

  return (
    <>
      {loading ? (
        <div className="py-8 flex justify-center text-muted-foreground">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        <div className="space-y-4 py-1">
          {rows.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground text-center py-4">Chưa có khoản trả góp nào.</p>
          )}

          {rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((r) => {
                const p = r.progress;
                const pct = (p.paidMonths / r.months) * 100;
                return (
                  <li key={r.id} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatCurrency(r.principal)}
                          {r.feeAmount > 0 && <> + phí {formatCurrency(r.feeAmount)}</>} · {r.months} kỳ · từ{" "}
                          {formatDate(r.startDate)}
                        </p>
                      </div>
                      {confirmDeleteId === r.id ? (
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDelete(r.id)}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-600 text-white cursor-pointer disabled:opacity-60"
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-border cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                          title="Xóa khoản trả góp (kèm giao dịch phí)"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", p.isCompleted ? "bg-emerald-500" : "bg-violet-500")}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {formatCurrency(p.monthlyAmount)}/kỳ · đã vào sao kê {p.paidMonths}/{r.months} kỳ
                      </span>
                      <span className={cn("font-semibold", p.isCompleted ? "text-emerald-600" : "text-foreground")}>
                        {p.isCompleted ? "Hoàn tất" : `Còn ${formatCurrency(p.remainingAmount)}`}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {showForm ? (
            <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
              <input type="hidden" name="walletId" value={card.id} />
              <input type="hidden" name="transactionId" value={transactionId} />

              {candidates.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Chuyển đổi từ giao dịch (tùy chọn)
                  </label>
                  <select
                    value={transactionId}
                    onChange={(e) => (e.target.value ? pickCandidate(e.target.value) : setTransactionId(""))}
                    className="form-input"
                  >
                    <option value="">— Nhập tay (giao dịch mua đã được ghi trên thẻ này) —</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {formatDate(c.recordedAt)} · {formatCurrency(c.amount)} · {c.note || "Không ghi chú"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!transactionId && (
                <p className="text-[11px] text-muted-foreground">
                  Khi nhập tay, hãy chắc khoản mua gốc đã được ghi là giao dịch chi trên thẻ này — trả góp chỉ phân bổ lại số tiền đó theo kỳ.
                </p>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Tên khoản trả góp *</label>
                <input
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="VD: iPhone 17 Pro"
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Số tiền gốc (₫) *</label>
                  <SmartCurrencyInput
                    name="principal"
                    value={principal}
                    onChangeValue={(v) => setPrincipal(v)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Số kỳ (tháng) *</label>
                  <select
                    name="months"
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                    className="form-input"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m} tháng
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Phí chuyển đổi / lãi (₫)</label>
                  <SmartCurrencyInput
                    name="feeAmount"
                    value={fee}
                    onChangeValue={(v) => setFee(v)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    name="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="text-xs rounded-lg bg-card border border-border p-2.5 flex items-center justify-between">
                <span className="text-muted-foreground">Mỗi kỳ phải trả</span>
                <span className="font-bold text-violet-700">{formatCurrency(monthly)}</span>
              </div>
              {Number(fee) > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Phí chuyển đổi sẽ được ghi nhận thành 1 giao dịch chi tiêu trên thẻ.
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Hủy
                </button>
                <button type="submit" disabled={isPending} className="btn-primary text-xs disabled:opacity-60">
                  {isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                  Tạo trả góp
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-violet-300 text-violet-700 hover:bg-violet-50 text-xs font-bold cursor-pointer"
            >
              <Plus size={14} /> Thêm khoản trả góp
            </button>
          )}
        </div>
      )}
    </>
  );
}
