"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logout } from "@/actions/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTimeFilter } from "./SidebarTimeFilter";
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
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard",    label: "Tổng quan",  icon: LayoutDashboard },
  { href: "/transactions", label: "Giao dịch",  icon: ArrowLeftRight  },
  { href: "/import",       label: "AI Import",  icon: Sparkles        },
  { href: "/reports",      label: "Báo cáo",    icon: BarChart3       },
  { href: "/budget",       label: "Ngân sách",  icon: Wallet          },
  { href: "/investments",  label: "Đầu tư",     icon: TrendingUp      },
  { href: "/debts",        label: "Nợ",         icon: HandCoins       },
  { href: "/goals",        label: "Mục tiêu",   icon: Target          },
  { href: "/settings",     label: "Cài đặt",    icon: Settings        },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
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
        className={`
          fixed top-0 left-0 bottom-0 w-[var(--sidebar-width)] 
          bg-card border-r border-border
          flex flex-col z-50 
          shadow-lg lg:shadow-none
          transition-transform duration-200 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border shrink-0 bg-card">
          <Link href="/dashboard" className="flex items-center gap-3 group" onClick={() => onClose?.()}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-sm shadow-orange-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Coins size={18} />
            </div>
            <div>
              <div className="text-base font-bold text-foreground tracking-tight leading-tight">wnWallet</div>
              <div className="text-[11px] text-muted-foreground font-medium leading-none mt-0.5">Quản lý tài chính</div>
            </div>
          </Link>

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

        {/* Sidebar Time Filter (Month & Year) */}
        <div className="border-b border-border/70 pb-1">
          <SidebarTimeFilter onClose={onClose} />
        </div>

        {/* Navigation Items (ScrollArea) */}
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="px-3 mb-2">
            <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
              Menu chính
            </span>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}`));
              const Icon = item.icon;

              const targetHref =
                searchStr && ["/dashboard", "/transactions", "/reports", "/budget"].includes(item.href)
                  ? `${item.href}?${searchStr}`
                  : item.href;

              return (
                <Link
                  key={item.href}
                  href={targetHref}
                  onClick={() => onClose?.()}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                    ${isActive
                      ? "bg-orange-50 text-orange-700 font-semibold shadow-xs border border-orange-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent"
                    }
                  `}
                >
                  <div
                    className={`
                      w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors
                      ${isActive
                        ? "bg-orange-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-500 group-hover:text-slate-700"
                      }
                    `}
                  >
                    <Icon size={15} />
                  </div>
                  <span className="truncate flex-1">{item.label}</span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer with Logout */}
        <div className="p-3 border-t border-border bg-slate-50/50 shrink-0">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 hover:text-rose-600">
                <LogOut size={15} />
              </div>
              <span>Đăng xuất</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
