import React from "react";
import { cn, maskAccountNumber } from "@/lib/utils";
import { Landmark, CreditCard, Building2, Wallet as WalletIcon, Banknote } from "lucide-react";

interface WalletBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  wallet?: {
    id: string;
    name: string;
    bankName?: string | null;
    color?: string | null;
    icon?: string | null;
    accountNumber?: string | null;
  } | null;
  size?: "sm" | "md";
  interactive?: boolean;
}

export function WalletBadge({
  wallet,
  size = "sm",
  interactive = false,
  className,
  ...props
}: WalletBadgeProps) {
  if (!wallet) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium rounded-md bg-slate-100 text-slate-500 border border-slate-200/80",
          size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
          className
        )}
        {...props}
      >
        <WalletIcon size={size === "sm" ? 11 : 13} className="opacity-60 shrink-0" />
        <span>Chưa gán tài khoản</span>
      </span>
    );
  }

  // Determine Bank Theme
  const bank = (wallet.bankName || wallet.name || "").toLowerCase();
  let themeStyles = "bg-purple-50 text-purple-700 border-purple-200/80 hover:bg-purple-100/70";
  let BankIcon = Landmark;

  if (wallet.bankName === "CASH" || bank.includes("tiền mặt") || bank.includes("cash")) {
    themeStyles = "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/80";
    BankIcon = Banknote;
  } else if (bank.includes("techcombank") || bank.includes("tcb")) {
    themeStyles = "bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100/70";
    BankIcon = Building2;
  } else if (bank.includes("tpbank") || bank.includes("tpb")) {
    themeStyles = "bg-violet-50 text-violet-700 border-violet-200/80 hover:bg-violet-100/70";
    BankIcon = Landmark;
  } else if (bank.includes("vietcombank") || bank.includes("vcb")) {
    themeStyles = "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/70";
    BankIcon = Building2;
  } else if (bank.includes("mb") || bank.includes("mbbank")) {
    themeStyles = "bg-blue-50 text-blue-700 border-blue-200/80 hover:bg-blue-100/70";
    BankIcon = CreditCard;
  } else if (wallet.icon === "CreditCard") {
    BankIcon = CreditCard;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold rounded-md border transition-all duration-150 shadow-2xs",
        themeStyles,
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
        interactive && "cursor-pointer active:scale-95",
        className
      )}
      title={wallet.accountNumber ? `Số TK: ${maskAccountNumber(wallet.accountNumber)}` : wallet.name}
      {...props}
    >
      {React.createElement(BankIcon, { size: size === "sm" ? 11 : 13, className: "shrink-0" })}
      <span className="truncate max-w-[130px]">{wallet.name}</span>
    </span>
  );
}
