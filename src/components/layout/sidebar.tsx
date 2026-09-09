"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { logout } from "@/actions/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTimeFilter } from "./SidebarTimeFilter";
import { SidebarWalletSelector, WalletItem } from "./SidebarWalletSelector";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  Wallet,
  TrendingUp,
  HandCoins,
  Target,
  Settings,
  LogOut,
  Coins,
  X,
  Sparkles,
  PiggyBank,
  Landmark,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard",    label: "Tổng quan",      icon: LayoutDashboard },
  { href: "/transactions", label: "Giao dịch",      icon: ArrowLeftRight  },
  { href: "/wallets",      label: "Tài khoản",      icon: Landmark        },
  { href: "/import",       label: "AI Import",      icon: Sparkles        },
  { href: "/reports",      label: "Báo cáo",        icon: BarChart3       },
  { href: "/budget",       label: "Ngân sách",      icon: Wallet          },
  { href: "/investments",  label: "Đầu tư",         icon: TrendingUp      },
  { href: "/savings",      label: "Tiết kiệm",      icon: PiggyBank       },
  { href: "/debts",        label: "Sổ nợ",          icon: HandCoins       },
  { href: "/goals",        label: "Mục tiêu",       icon: Target          },
  { href: "/settings",     label: "Cài đặt",        icon: Settings        },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  wallets?: WalletItem[];
}

export function Sidebar({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  wallets = [],
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchStr = searchParams ? searchParams.toString() : "";

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 h-dvh max-h-screen bg-slate-900/90 backdrop-blur-2xl border-r border-white/10 flex flex-col z-50 shadow-2xl transition-all duration-300 ease-in-out overflow-hidden text-slate-200",
          // Mobile state
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Desktop width: 72px when collapsed, 250px when expanded
          isCollapsed ? "w-[250px] lg:w-[72px]" : "w-[250px]"
        )}
      >
        {/* Brand Header (Sticky at top) */}
        <div
          className={cn(
            "h-16 flex items-center border-b border-white/10 shrink-0 bg-slate-900/40 backdrop-blur-md transition-all duration-200 z-10",
            isCollapsed ? "justify-between px-5 lg:justify-center lg:px-2" : "justify-between px-5"
          )}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-3 group overflow-hidden"
            onClick={() => onClose?.()}
            title="OwnWallet — Quản lý tài chính"
          >
            {/* Desktop Collapsed view: 3D gold emblem */}
            <div className={cn("items-center justify-center shrink-0", isCollapsed ? "hidden lg:flex" : "hidden")}>
              <Image
                src="/icon-emblem-transparent.png"
                alt="OwnWallet"
                width={36}
                height={36}
                className="w-9 h-9 object-contain group-hover:scale-105 transition-transform drop-shadow-md"
              />
            </div>
            {/* Expanded view & Mobile drawer: Official full logo */}
            <div className={cn("items-center", isCollapsed ? "flex lg:hidden" : "flex")}>
              <Image
                src="/logo-transparent.png"
                alt="OwnWallet — Quản lý tài chính"
                width={175}
                height={48}
                className="h-10 w-auto max-w-[175px] object-contain group-hover:scale-[1.02] transition-transform brightness-105"
                priority
              />
            </div>
          </Link>

          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 lg:hidden transition-colors cursor-pointer"
              aria-label="Đóng menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Fixed Middle Area: Wallets & Time Filter (Non-scrollable) */}
        {wallets && wallets.length > 0 && (
          <div className="pt-1 pb-1 border-b border-white/10 transition-all shrink-0">
            <SidebarWalletSelector
              wallets={wallets}
              isCollapsed={isCollapsed}
              onClose={onClose}
            />
          </div>
        )}

        {/* Sidebar Time Filter (Month & Year) (Fixed) */}
        <div className="border-b border-white/10 pb-2 transition-all shrink-0">
          <SidebarTimeFilter isCollapsed={isCollapsed} onClose={onClose} />
        </div>

        {/* Scrollable Middle Area: Navigation Only */}
        <ScrollArea className="flex-1 min-h-0 w-full overflow-hidden">
          <div className="flex flex-col py-2">
            {/* Navigation Items */}
            <div className="px-2.5">
              <div className={cn("px-2.5 mb-2 transition-all", isCollapsed && "lg:hidden")}>
                <span className="text-[10px] font-bold text-slate-400/80 uppercase tracking-wider">
                  Menu chính
                </span>
              </div>

              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}`));
                  const Icon = item.icon;

                  const targetHref = searchStr ? `${item.href}?${searchStr}` : item.href;

                  return (
                    <Link
                      key={item.href}
                      href={targetHref}
                      onClick={() => onClose?.()}
                      title={item.label}
                      className={cn(
                        "flex items-center rounded-xl text-sm font-medium transition-all duration-150 group relative",
                        isCollapsed
                          ? "px-3 py-2.5 lg:justify-center lg:px-0 lg:py-2.5"
                          : "gap-3 px-3 py-2.5",
                        isActive
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold shadow-lg shadow-orange-500/25 border border-orange-400/40"
                          : "text-slate-300 hover:text-white hover:bg-white/10 border border-transparent"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                          isActive
                            ? "bg-white/20 text-white shadow-xs"
                            : "bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-white/15"
                        )}
                      >
                        <Icon size={16} />
                      </div>

                      {/* Label (hidden in collapsed mode on desktop) */}
                      <span className={cn("truncate flex-1 transition-opacity", isCollapsed && "lg:hidden")}>
                        {item.label}
                      </span>

                      {/* Active indicator dot */}
                      {isActive && (
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full bg-white shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.8)]",
                            isCollapsed && "lg:hidden"
                          )}
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </ScrollArea>

        {/* Footer with Toggle & Logout (Sticky at bottom) */}
        <div className="p-2.5 border-t border-white/10 bg-slate-950/40 shrink-0 space-y-1 z-10">
          {/* Desktop Collapse Toggle Button at bottom */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
              className="hidden lg:flex items-center justify-center rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer w-full py-2"
            >
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-slate-400 group-hover:text-white">
                {isCollapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
              </div>
            </button>
          )}

          {/* Logout button */}
          <form action={logout}>
            <button
              type="submit"
              title="Đăng xuất"
              className={cn(
                "w-full flex items-center rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer py-2",
                isCollapsed ? "justify-center px-0 lg:py-2" : "gap-2.5 px-3"
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-slate-400 group-hover:text-rose-400">
                <LogOut size={14} />
              </div>
              <span className={cn("truncate", isCollapsed && "lg:hidden")}>Đăng xuất</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
