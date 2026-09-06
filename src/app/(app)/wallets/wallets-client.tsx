"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Building2,
  CreditCard,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  createWallet,
  updateWallet,
  deleteWallet,
  reassignTransactions,
} from "@/actions/wallets";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

interface WalletItem {
  id: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  balance: number;
  currentBalance: number;
  income: number;
  expense: number;
  txCount: number;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface WalletsClientProps {
  initialWallets: WalletItem[];
  unassignedCount: number;
}

export function WalletsClient({ initialWallets, unassignedCount }: WalletsClientProps) {
  const wallets = initialWallets;

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [reassignTargetId, setReassignTargetId] = useState<string>(
    wallets[0]?.id || ""
  );

  // Summary stats
  const totalBalance = wallets.reduce((sum, w) => sum + w.currentBalance, 0);
  const totalIncome = wallets.reduce((sum, w) => sum + w.income, 0);
  const totalExpense = wallets.reduce((sum, w) => sum + w.expense, 0);
  const totalTxs = wallets.reduce((sum, w) => sum + w.txCount, 0);

  // Bank Theme Helper
  const getCardTheme = (wallet: WalletItem) => {
    const bank = (wallet.bankName || wallet.name || "").toLowerCase();
    if (bank.includes("tpbank") || bank.includes("tpb")) {
      return {
        gradient: "from-violet-700 via-purple-700 to-indigo-900",
        chipColor: "bg-amber-300/80",
        badgeBg: "bg-white/15 text-white border-white/20",
        bankTitle: "TPBank",
        icon: Landmark,
      };
    }
    if (bank.includes("techcombank") || bank.includes("tcb")) {
      return {
        gradient: "from-rose-600 via-red-700 to-rose-950",
        chipColor: "bg-amber-300/80",
        badgeBg: "bg-white/15 text-white border-white/20",
        bankTitle: "Techcombank",
        icon: Building2,
      };
    }
    if (bank.includes("vietcombank") || bank.includes("vcb")) {
      return {
        gradient: "from-emerald-700 via-teal-800 to-slate-900",
        chipColor: "bg-amber-300/80",
        badgeBg: "bg-white/15 text-white border-white/20",
        bankTitle: "Vietcombank",
        icon: Building2,
      };
    }
    return {
      gradient: "from-slate-800 via-slate-900 to-zinc-950",
      chipColor: "bg-amber-300/80",
      badgeBg: "bg-white/15 text-white border-white/20",
      bankTitle: wallet.bankName || "Tài khoản ngân hàng",
      icon: CreditCard,
    };
  };

  // Form submit handlers
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await createWallet(fd);
    if (res.error) {
      toast.error("Vui lòng kiểm tra lại thông tin");
    } else {
      toast.success("Đã thêm tài khoản mới!");
      setIsCreateOpen(false);
      window.location.reload();
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingWallet) return;
    const fd = new FormData(e.currentTarget);
    const res = await updateWallet(editingWallet.id, fd);
    if (res.error) {
      toast.error("Vui lòng kiểm tra lại thông tin");
    } else {
      toast.success("Đã cập nhật thông tin tài khoản!");
      setEditingWallet(null);
      window.location.reload();
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    const res = await deleteWallet(deletingId);
    if (res.success) {
      toast.success("Đã xóa tài khoản!");
      setDeletingId(null);
      window.location.reload();
    }
  }

  async function handleReassign() {
    if (!reassignTargetId) return;
    const res = await reassignTransactions("UNASSIGNED", reassignTargetId);
    if (res.success) {
      toast.success("Đã chuyển các giao dịch sang tài khoản mới!");
      setIsReassignOpen(false);
      window.location.reload();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <Landmark className="text-orange-600" size={24} />
            <span>Tài khoản ngân hàng</span>
          </h1>
          <p className="text-muted text-sm mt-1">
            Quản lý các tài khoản ngân hàng (TPBank, Techcombank...) và theo dõi số dư thực tế
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {unassignedCount > 0 && (
            <button
              type="button"
              onClick={() => setIsReassignOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw size={13} className="text-amber-700" />
              <span>Gán {unassignedCount} GD chưa có tài khoản</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="btn-primary"
          >
            <Plus size={16} /> Thêm tài khoản mới
          </button>
        </div>
      </div>

      {/* ─── KPI Overview ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Tổng số dư */}
        <div className="card p-4 flex flex-col justify-between border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Tổng số dư thực tế
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
              <Landmark size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl md:text-2xl font-extrabold text-foreground truncate">
              {formatCurrency(totalBalance)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Từ {wallets.length} tài khoản đang hoạt động
            </p>
          </div>
        </div>

        {/* Tổng thu */}
        <div className="card p-4 flex flex-col justify-between border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Tổng tiền nạp vào
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl md:text-2xl font-extrabold text-emerald-600 truncate">
              +{formatCurrency(totalIncome)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Giao dịch thu qua các tài khoản
            </p>
          </div>
        </div>

        {/* Tổng chi */}
        <div className="card p-4 flex flex-col justify-between border-rose-500/20 bg-rose-500/5">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Tổng tiền chi ra
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-600">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl md:text-2xl font-extrabold text-rose-600 truncate">
              -{formatCurrency(totalExpense)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Giao dịch chi qua các tài khoản
            </p>
          </div>
        </div>

        {/* Tổng GD */}
        <div className="card p-4 flex flex-col justify-between border-border bg-card">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tổng giao dịch
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl md:text-2xl font-extrabold text-foreground truncate">
              {totalTxs}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Đã ghi nhận trong hệ thống
            </p>
          </div>
        </div>
      </div>

      {/* ─── Grid of Bank Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
        {wallets.map((wallet) => {
          const theme = getCardTheme(wallet);

          return (
            <div
              key={wallet.id}
              className="card overflow-hidden border border-border/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Bank Card Face UI */}
              <div
                className={`p-5 bg-gradient-to-br ${theme.gradient} text-white relative overflow-hidden rounded-t-xl min-h-[170px] flex flex-col justify-between`}
              >
                {/* Background decorative circles */}
                <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute right-12 -top-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

                {/* Card Top: Bank & Status */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    {React.createElement(theme.icon, { size: 20, className: "text-white/90" })}
                    <span className="font-extrabold tracking-tight text-sm uppercase">
                      {theme.bankTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {wallet.isDefault && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 shadow-2xs">
                        Mặc định
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${theme.badgeBg}`}>
                      {wallet.name}
                    </span>
                  </div>
                </div>

                {/* EMV Chip & Account number */}
                <div className="my-2 z-10 flex items-center justify-between">
                  {/* EMV Chip */}
                  <div className={`w-9 h-6 rounded-md ${theme.chipColor} border border-amber-400/50 flex flex-col justify-around p-0.5 shadow-xs`}>
                    <div className="w-full h-0.5 bg-amber-600/40 rounded" />
                    <div className="w-full h-0.5 bg-amber-600/40 rounded" />
                  </div>

                  {/* Account Number */}
                  <div className="font-mono text-xs tracking-widest text-white/80">
                    {wallet.accountNumber
                      ? wallet.accountNumber.length > 8
                        ? `•••• •••• ${wallet.accountNumber.slice(-4)}`
                        : wallet.accountNumber
                      : "•••• •••• ••••"}
                  </div>
                </div>

                {/* Card Bottom: Balance */}
                <div className="z-10">
                  <span className="text-[10px] text-white/70 uppercase font-semibold tracking-wider block">
                    Số dư khả dụng
                  </span>
                  <p className="text-xl md:text-2xl font-black tracking-tight text-white mt-0.5 truncate">
                    {formatCurrency(wallet.currentBalance)}
                  </p>
                </div>
              </div>

              {/* Card Footer: Stats & Actions */}
              <div className="p-4 bg-card flex-1 flex flex-col justify-between">
                {/* Mini Stats */}
                <div className="grid grid-cols-3 gap-2 py-2 border-b border-border/70 text-center">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Thu vào</span>
                    <span className="text-xs font-bold text-emerald-600 truncate block">
                      +{formatCurrency(wallet.income)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Chi ra</span>
                    <span className="text-xs font-bold text-rose-600 truncate block">
                      -{formatCurrency(wallet.expense)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Giao dịch</span>
                    <span className="text-xs font-bold text-foreground block">
                      {wallet.txCount} GD
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 gap-2">
                  <Link
                    href={`/transactions`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-focus transition-colors"
                  >
                    <span>Lọc giao dịch</span>
                    <ArrowRight size={13} />
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingWallet(wallet)}
                      className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                      title="Chỉnh sửa thông tin"
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingId(wallet.id)}
                      className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Xóa tài khoản"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Modal Thêm tài khoản mới ───────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm tài khoản / ví mới</DialogTitle>
            <DialogDescription>
              Tạo tài khoản ngân hàng hoặc ví để phân loại giao dịch
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Tên tài khoản / ví <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="VD: TPBank - TK 2, Techcombank, Tiền mặt..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Ngân hàng
                </label>
                <select
                  name="bankName"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
                >
                  <option value="TPBank">TPBank</option>
                  <option value="Techcombank">Techcombank</option>
                  <option value="Vietcombank">Vietcombank</option>
                  <option value="MBBank">MB Bank</option>
                  <option value="VPBank">VPBank</option>
                  <option value="Khác">Khác / Ví tiền mặt</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Số tài khoản (nếu có)
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  placeholder="VD: 53510122..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Số dư ban đầu (VNĐ)
              </label>
              <input
                type="number"
                name="balance"
                defaultValue={0}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isDefaultCreate"
                name="isDefault"
                value="true"
                className="rounded border-border"
              />
              <label htmlFor="isDefaultCreate" className="text-xs font-medium text-foreground cursor-pointer">
                Đặt làm tài khoản chính mặc định
              </label>
            </div>

            <DialogFooter className="pt-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Hủy
              </button>
              <button type="submit" className="btn-primary text-xs">
                Tạo tài khoản
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Modal Chỉnh sửa tài khoản ──────────────────────────── */}
      <Dialog open={!!editingWallet} onOpenChange={(open) => !open && setEditingWallet(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa tài khoản</DialogTitle>
            <DialogDescription>
              Cập nhật tên, ngân hàng hoặc số tài khoản
            </DialogDescription>
          </DialogHeader>

          {editingWallet && (
            <form onSubmit={handleUpdate} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Tên tài khoản / ví <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingWallet.name}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Ngân hàng
                  </label>
                  <select
                    name="bankName"
                    defaultValue={editingWallet.bankName || "Khác"}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
                  >
                    <option value="TPBank">TPBank</option>
                    <option value="Techcombank">Techcombank</option>
                    <option value="Vietcombank">Vietcombank</option>
                    <option value="MBBank">MB Bank</option>
                    <option value="VPBank">VPBank</option>
                    <option value="Khác">Khác / Ví tiền mặt</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Số tài khoản
                  </label>
                  <input
                    type="text"
                    name="accountNumber"
                    defaultValue={editingWallet.accountNumber || ""}
                    placeholder="VD: 53510122..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Số dư ban đầu (VNĐ)
                </label>
                <input
                  type="number"
                  name="balance"
                  defaultValue={editingWallet.balance}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefaultEdit"
                  name="isDefault"
                  value="true"
                  defaultChecked={editingWallet.isDefault}
                  className="rounded border-border"
                />
                <label htmlFor="isDefaultEdit" className="text-xs font-medium text-foreground cursor-pointer">
                  Đặt làm tài khoản chính mặc định
                </label>
              </div>

              <DialogFooter className="pt-3">
                <button
                  type="button"
                  onClick={() => setEditingWallet(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Lưu thay đổi
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Modal Gán giao dịch chưa có ví ───────────────────── */}
      <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gán giao dịch chưa liên kết tài khoản</DialogTitle>
            <DialogDescription>
              Hiện có {unassignedCount} giao dịch chưa được liên kết với tài khoản nào. Bạn muốn gán vào tài khoản nào?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Chọn tài khoản nhận
              </label>
              <select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.bankName ? `(${w.bankName})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsReassignOpen(false)}
              className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleReassign}
              className="btn-primary text-xs"
            >
              Xác nhận gán {unassignedCount} giao dịch
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Alert Xóa tài khoản ──────────────────────────────── */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa tài khoản?</AlertDialogTitle>
            <AlertDialogDescription>
              Các giao dịch đã liên kết với tài khoản này sẽ được chuyển thành trạng thái &quot;Chưa gán tài khoản&quot;, không bị mất dữ liệu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
              Xóa tài khoản
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
