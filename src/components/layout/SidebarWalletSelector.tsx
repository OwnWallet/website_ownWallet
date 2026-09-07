"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  CreditCard,
  Landmark,
  Building2,
  Check,
  ChevronsUpDown,
  Wallet,
  Sparkles,
  ArrowRight,
  Banknote,
} from "lucide-react";
import Link from "next/link";
import { cn, formatCurrencyCompact, maskAccountNumber } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface WalletItem {
  id: string;
  name: string;
  bankName?: string | null;
  accountNumber?: string | null;
  color?: string | null;
  currentBalance?: number;
  balance?: number;
  txCount?: number;
  isDefault?: boolean;
}

interface Props {
  wallets: WalletItem[];
  isCollapsed?: boolean;
  onClose?: () => void;
}

export function SidebarWalletSelector({ wallets = [], isCollapsed = false, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedWalletId = searchParams ? searchParams.get("wallet") || "ALL" : "ALL";

  const selectedWallet =
    selectedWalletId === "ALL"
      ? null
      : selectedWalletId === "UNASSIGNED"
      ? { id: "UNASSIGNED", name: "Chưa gán tài khoản", bankName: "Khác", accountNumber: "" }
      : wallets.find((w) => w.id === selectedWalletId) || null;

  function handleSelect(walletId: string) {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (walletId === "ALL") {
      params.delete("wallet");
    } else {
      params.set("wallet", walletId);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
      onClose?.();
    });
  }

  function getBankBadge(bank?: string | null, name?: string) {
    const text = (bank || name || "").toLowerCase();
    if (bank === "CASH" || text.includes("tiền mặt") || text.includes("cash")) {
      return {
        label: "TIỀN",
        bg: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icon: Banknote,
      };
    }
    if (text.includes("tpbank") || text.includes("tpb")) {
      return {
        label: "TPB",
        bg: "bg-purple-100 text-purple-700 border-purple-200",
        icon: Landmark,
      };
    }
    if (text.includes("techcombank") || text.includes("tcb")) {
      return {
        label: "TCB",
        bg: "bg-rose-100 text-rose-700 border-rose-200",
        icon: Building2,
      };
    }
    if (text.includes("vietcombank") || text.includes("vcb")) {
      return {
        label: "VCB",
        bg: "bg-emerald-100 text-emerald-700 border-emerald-200",
        icon: Building2,
      };
    }
    return {
      label: "VÍ",
      bg: "bg-orange-100 text-orange-700 border-orange-200",
      icon: CreditCard,
    };
  }

  const activeBadge = selectedWallet
    ? getBankBadge(selectedWallet.bankName, selectedWallet.name)
    : { label: "TẤT CẢ", bg: "bg-orange-100 text-orange-700 border-orange-200", icon: Wallet };

  return (
    <div className={cn("transition-all duration-200", isCollapsed ? "px-2 mb-2" : "mx-3 mb-2")}>
      <DropdownMenu>
        <DropdownMenuTrigger
          title={
            selectedWallet
              ? `Tài khoản đang chọn: ${selectedWallet.name}`
              : "Tất cả tài khoản thanh toán"
          }
          className={cn(
            "w-full rounded-xl border transition-all cursor-pointer outline-none group text-left",
            isCollapsed
              ? "p-2 flex items-center justify-center border-white/10 bg-white/5 hover:border-orange-400/50 hover:bg-white/10"
              : "p-2.5 flex items-center justify-between gap-2.5 bg-white/5 border-white/10 shadow-2xs hover:border-orange-400/50 hover:bg-white/10",
            selectedWalletId !== "ALL" && !isCollapsed && "border-orange-400/50 bg-orange-500/15",
            isPending && "opacity-70 animate-pulse"
          )}
        >
          {/* Collapsed view: Icon Only */}
          {isCollapsed ? (
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-[11px] border shadow-2xs transition-transform group-hover:scale-105",
                activeBadge.bg
              )}
            >
              {selectedWalletId === "ALL" ? (
                <Wallet size={16} />
              ) : (
                <span>{activeBadge.label}</span>
              )}
            </div>
          ) : (
            /* Expanded view: Full Account info */
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-[10px] border shadow-2xs shrink-0",
                    activeBadge.bg
                  )}
                >
                  {selectedWalletId === "ALL" ? (
                    <Wallet size={15} />
                  ) : (
                    <span>{activeBadge.label}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-100 truncate leading-tight">
                      {selectedWallet ? selectedWallet.name : "Tất cả tài khoản"}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                    {selectedWallet?.accountNumber
                      ? `STK: ${maskAccountNumber(selectedWallet.accountNumber)}`
                      : selectedWallet
                      ? "Tài khoản riêng lẻ"
                      : `${wallets.length} tài khoản liên kết`}
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-slate-400 group-hover:text-slate-200 transition-colors">
                <ChevronsUpDown size={14} />
              </div>
            </>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={isCollapsed ? "start" : "start"}
          side={isCollapsed ? "right" : "bottom"}
          className="w-68 p-1.5 shadow-xl border-border bg-card"
        >
          <DropdownMenuLabel className="font-semibold text-xs px-2 py-1.5 text-foreground flex items-center justify-between">
            <span>Chọn tài khoản / thẻ</span>
            <span className="text-[10px] font-normal text-muted-foreground">
              {wallets.length} tài khoản
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Option: Tất cả tài khoản */}
          <DropdownMenuItem
            onClick={() => handleSelect("ALL")}
            className={cn(
              "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
              selectedWalletId === "ALL" ? "bg-orange-50 text-orange-950 font-semibold" : ""
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center shrink-0">
                <Wallet size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate leading-tight">Tất cả tài khoản</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  Xem toàn bộ dòng tiền tổng hợp
                </p>
              </div>
            </div>
            {selectedWalletId === "ALL" && (
              <Check size={15} className="text-orange-600 shrink-0 ml-2" />
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* List of wallets */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5">
            {wallets.map((wallet) => {
              const badge = getBankBadge(wallet.bankName, wallet.name);
              const isSelected = selectedWalletId === wallet.id;
              const balance = wallet.currentBalance ?? wallet.balance;

              return (
                <DropdownMenuItem
                  key={wallet.id}
                  onClick={() => handleSelect(wallet.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                    isSelected ? "bg-orange-50 text-orange-950 font-semibold" : ""
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-[10px] border shadow-2xs shrink-0",
                        badge.bg
                      )}
                    >
                      {badge.label}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate leading-tight">
                        {wallet.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {wallet.accountNumber ? `STK: ${maskAccountNumber(wallet.accountNumber)}` : "Tài khoản"}
                        {balance !== undefined && ` · ${formatCurrencyCompact(balance)}`}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <Check size={15} className="text-orange-600 shrink-0 ml-2" />
                  )}
                </DropdownMenuItem>
              );
            })}

            {/* Option: Chưa gán ví */}
            <DropdownMenuItem
              onClick={() => handleSelect("UNASSIGNED")}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-slate-500",
                selectedWalletId === "UNASSIGNED" ? "bg-orange-50 text-orange-950 font-semibold" : ""
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center shrink-0 text-[10px] font-bold">
                  ?
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate leading-tight">
                    Chưa gán tài khoản
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    Các giao dịch chưa liên kết ví
                  </p>
                </div>
              </div>
              {selectedWalletId === "UNASSIGNED" && (
                <Check size={15} className="text-orange-600 shrink-0 ml-2" />
              )}
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator />

          {/* Quick link to manage wallets */}
          <DropdownMenuItem className="p-0">
            <Link
              href="/wallets"
              onClick={() => onClose?.()}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50/80 rounded-md font-semibold transition-colors"
            >
              <span>💳 Quản lý tài khoản</span>
              <ArrowRight size={13} />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
