"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Landmark, Building2, CreditCard, ChevronDown, Check, Banknote } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export interface WalletOption {
  id: string;
  name: string;
  bankName?: string | null;
  accountNumber?: string | null;
  color?: string | null;
  icon?: string | null;
  txCount?: number;
}

interface AccountFilterProps {
  wallets: WalletOption[];
  selectedWallet: string; // "ALL" | "UNASSIGNED" | walletId
  onSelectWallet: (walletId: string) => void;
  variant?: "dropdown" | "pills";
  className?: string;
  size?: "sm" | "md";
}

function getBankIcon(wallet?: WalletOption | null) {
  if (!wallet) return Landmark;
  if (wallet.bankName === "CASH" || (wallet.bankName || wallet.name || "").toLowerCase().includes("tiền mặt")) {
    return Banknote;
  }
  const name = (wallet.bankName || wallet.name || "").toLowerCase();
  if (name.includes("techcombank") || name.includes("tcb")) return Building2;
  if (name.includes("tpbank") || name.includes("tpb")) return Landmark;
  return CreditCard;
}

export function AccountFilter({
  wallets,
  selectedWallet,
  onSelectWallet,
  variant = "dropdown",
  className,
  size = "md",
}: AccountFilterProps) {
  const selectedObj = wallets.find((w) => w.id === selectedWallet);

  const SelectedIcon = selectedWallet === "ALL"
    ? Landmark
    : selectedWallet === "UNASSIGNED"
    ? CreditCard
    : getBankIcon(selectedObj);

  const displayText = selectedWallet === "ALL"
    ? "Tất cả tài khoản"
    : selectedWallet === "UNASSIGNED"
    ? "Chưa gán tài khoản"
    : selectedObj?.name || "Chọn tài khoản";

  if (variant === "pills") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <button
          type="button"
          onClick={() => onSelectWallet("ALL")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border shadow-2xs",
            selectedWallet === "ALL"
              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
              : "bg-card text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground"
          )}
        >
          <Landmark size={13} className="shrink-0" />
          <span>Tất cả</span>
        </button>

        {wallets.map((w) => {
          const isSelected = selectedWallet === w.id;
          const isCash = w.bankName === "CASH" || (w.bankName || w.name).toLowerCase().includes("tiền mặt");
          const isTpb = (w.bankName || w.name).toLowerCase().includes("tpb");
          const isTcb = (w.bankName || w.name).toLowerCase().includes("techcombank") || (w.bankName || w.name).toLowerCase().includes("tcb");

          let activeStyle = "bg-orange-600 text-white border-orange-600 shadow-xs";
          if (isCash) activeStyle = "bg-emerald-600 text-white border-emerald-600 shadow-xs";
          else if (isTpb) activeStyle = "bg-violet-600 text-white border-violet-600 shadow-xs";
          else if (isTcb) activeStyle = "bg-rose-600 text-white border-rose-600 shadow-xs";

          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onSelectWallet(w.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border shadow-2xs",
                isSelected
                  ? activeStyle
                  : "bg-card text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {React.createElement(getBankIcon(w), { size: 13, className: "shrink-0" })}
              <span>{w.name}</span>
              {w.txCount !== undefined && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {w.txCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-card hover:bg-slate-50 transition-all cursor-pointer shadow-2xs outline-none text-foreground font-medium",
          size === "sm" ? "px-2.5 py-1.5 text-xs h-8" : "px-3 py-2 text-xs h-9",
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {React.createElement(SelectedIcon, {
            size: 14,
            className: cn(
              "shrink-0",
              selectedWallet === "ALL" ? "text-slate-500" : "text-orange-500"
            ),
          })}
          <span className="truncate max-w-[140px] font-semibold">{displayText}</span>
        </div>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56 p-1.5 bg-card border-border shadow-lg">
        <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
          Lọc theo tài khoản
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => onSelectWallet("ALL")}
          className={cn(
            "flex items-center justify-between text-xs px-2.5 py-2 rounded-lg cursor-pointer",
            selectedWallet === "ALL" ? "bg-orange-50 text-orange-700 font-bold" : ""
          )}
        >
          <div className="flex items-center gap-2">
            <Landmark size={14} className="text-slate-500" />
            <span>Tất cả tài khoản</span>
          </div>
          {selectedWallet === "ALL" && <Check size={14} className="text-orange-600" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {wallets.map((w) => {
          const isSelected = selectedWallet === w.id;
          const isCash = w.bankName === "CASH" || (w.bankName || w.name).toLowerCase().includes("tiền mặt");
          const isTpb = (w.bankName || w.name).toLowerCase().includes("tpb");
          const isTcb = (w.bankName || w.name).toLowerCase().includes("techcombank");

          let iconColor = "text-orange-500";
          if (isCash) iconColor = "text-emerald-600";
          else if (isTpb) iconColor = "text-violet-500";
          else if (isTcb) iconColor = "text-rose-500";

          return (
            <DropdownMenuItem
              key={w.id}
              onClick={() => onSelectWallet(w.id)}
              className={cn(
                "flex items-center justify-between text-xs px-2.5 py-2 rounded-lg cursor-pointer",
                isSelected ? "bg-orange-50 text-orange-700 font-bold" : ""
              )}
            >
              <div className="flex items-center gap-2 truncate">
                {React.createElement(getBankIcon(w), { size: 14, className: iconColor })}
                <div className="flex flex-col truncate">
                  <span className="truncate">{w.name}</span>
                  {w.accountNumber && (
                    <span className="text-[10px] text-muted-foreground font-normal">
                      STK: {w.accountNumber}
                    </span>
                  )}
                </div>
              </div>
              {isSelected && <Check size={14} className="text-orange-600 shrink-0" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => onSelectWallet("UNASSIGNED")}
          className={cn(
            "flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg cursor-pointer text-muted-foreground",
            selectedWallet === "UNASSIGNED" ? "bg-slate-100 text-foreground font-bold" : ""
          )}
        >
          <div className="flex items-center gap-2">
            <CreditCard size={14} className="text-slate-400" />
            <span>Chưa gán tài khoản</span>
          </div>
          {selectedWallet === "UNASSIGNED" && <Check size={14} className="text-foreground" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
