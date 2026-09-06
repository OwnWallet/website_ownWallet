"use client";

import Link from "next/link";
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
          "fixed top-0 left-0 bottom-0 h-dvh max-h-screen bg-card border-r border-border flex flex-col z-50 shadow-lg lg:shadow-none transition-all duration-300 ease-in-out overflow-hidden",
          // Mobile state
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Desktop width: 72px when collapsed, 250px when expanded
          isCollapsed ? "w-[250px] lg:w-[72px]" : "w-[250px]"
        )}
      >
        {/* Brand Header (Sticky at top) */}
        <div
          className={cn(
            "h-16 flex items-center border-b border-border shrink-0 bg-card transition-all duration-200 z-10",
            isCollapsed ? "justify-between px-5 lg:justify-center lg:px-2" : "justify-between px-5"
          )}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-3 group overflow-hidden"
            onClick={() => onClose?.()}
            title="wnWallet — Quản lý tài chính"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-sm shadow-orange-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Coins size={18} />
            </div>
            <div className={cn("transition-opacity duration-200", isCollapsed && "lg:hidden")}>
              <div className="text-base font-bold text-foreground tracking-tight leading-tight">wnWallet</div>
              <div className="text-[11px] text-muted-foreground font-medium leading-none mt-0.5">Quản lý tài chính</div>
            </div>
          </Link>

          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden transition-colors cursor-pointer"
              aria-label="Đóng menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Scrollable Middle Area: Wallets, Time Filter & Navigation */}
        <ScrollArea className="flex-1 min-h-0 w-full overflow-hidden">
          <div className="flex flex-col py-2">
            {/* Card / Account Selector in Sidebar */}
            {wallets && wallets.length > 0 && (
              <div className="pt-0.5 pb-1 border-b border-border/70 transition-all shrink-0">
                <SidebarWalletSelector
                  wallets={wallets}
                  isCollapsed={isCollapsed}
                  onClose={onClose}
                />
              </div>
            )}

            {/* Sidebar Time Filter (Month & Year) */}
            <div className="border-b border-border/70 pb-2 mb-2 transition-all shrink-0">
              <SidebarTimeFilter isCollapsed={isCollapsed} onClose={onClose} />
            </div>

            {/* Navigation Items */}
            <div className="px-2.5">
              <div className={cn("px-2.5 mb-2 transition-all", isCollapsed && "lg:hidden")}>
                <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
                  Menu chính
                </span>
              </div>

              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}`));
                  const Icon = item.icon;

                  const targetHref =
                    searchStr && ["/dashboard", "/transactions", "/reports", "/budget", "/wallets"].includes(item.href)
                      ? `${item.href}?${searchStr}`
                      : item.href;

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
                          ? "bg-orange-50 text-orange-700 font-semibold shadow-2xs border border-orange-200/80"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                          isActive
                            ? "bg-orange-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-200/60"
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
                            "w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0",
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
        <div className="p-2.5 border-t border-border bg-[var(--bg-elevated)]/50 shrink-0 space-y-1 z-10">
          {/* Desktop Collapse Toggle Button at bottom */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
              className={cn(
                "hidden lg:flex items-center rounded-xl text-xs font-medium text-slate-500 hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all cursor-pointer w-full py-2",
                isCollapsed ? "justify-center px-0" : "gap-2.5 px-3"
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                {isCollapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
              </div>
              <span className={cn("truncate transition-opacity", isCollapsed && "lg:hidden")}>
                Thu gọn thanh bên
              </span>
            </button>
          )}

          {/* Logout button */}
          <form action={logout}>
            <button
              type="submit"
              title="Đăng xuất"
              className={cn(
                "w-full flex items-center rounded-xl text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer py-2",
                isCollapsed ? "justify-center px-0 lg:py-2" : "gap-2.5 px-3"
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 group-hover:text-rose-600">
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
