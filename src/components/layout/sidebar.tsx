"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
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
  Banknote,
  HandCoins,
  Target,
  Settings,
  X,
  FileUp,
  Landmark,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    title: "Chung",
    items: [
      { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/reports", label: "Báo cáo & AI", icon: BarChart3 },
    ],
  },
  {
    title: "Dòng tiền & Ngân sách",
    items: [
      { href: "/transactions", label: "Sổ giao dịch", icon: ArrowLeftRight },
      { href: "/income", label: "Dòng tiền định kỳ", icon: Banknote },
      { href: "/budget", label: "Ngân sách", icon: Wallet },
      { href: "/import", label: "Import sao kê", icon: FileUp },
    ],
  },
  {
    title: "Tài sản & Công nợ",
    items: [
      { href: "/wallets", label: "Ví & Tài khoản", icon: Landmark },
      { href: "/investments", label: "Đầu tư", icon: TrendingUp },
      { href: "/debts", label: "Sổ nợ", icon: HandCoins },
      { href: "/goals", label: "Mục tiêu & Tiết kiệm", icon: Target },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { href: "/settings", label: "Cài đặt", icon: Settings },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  wallets?: WalletItem[];
  sidebarWidth?: number;
  onWidthChange?: (width: number) => void;
  onResetWidth?: () => void;
  isResizing?: boolean;
  setIsResizing?: (resizing: boolean) => void;
}

export function Sidebar({
  isOpen,
  onClose,
  isCollapsed = false,
  wallets = [],
  sidebarWidth = 260,
  onWidthChange,
  onResetWidth,
  isResizing = false,
  setIsResizing,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchStr = searchParams ? searchParams.toString() : "";

  // Close mobile sidebar on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Drag resizing logic on desktop
  useEffect(() => {
    if (!isResizing) return;

    function handleMouseMove(e: MouseEvent) {
      if (onWidthChange) {
        onWidthChange(e.clientX);
      }
    }

    function handleMouseUp(e: MouseEvent) {
      setIsResizing?.(false);
      try {
        const finalWidth = Math.min(Math.max(e.clientX, 210), 400);
        localStorage.setItem("ownwallet_sidebar_width", String(finalWidth));
      } catch {
        // Ignore
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onWidthChange, setIsResizing]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 h-dvh max-h-screen bg-slate-900/95 backdrop-blur-2xl border-r border-white/10 flex flex-col z-50 shadow-2xl overflow-hidden text-slate-200",
          // Mobile state: slide in/out
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Mobile width is always a comfortable 280px drawer; Desktop uses dynamic .sidebar-desktop-width
          "w-[280px] sidebar-desktop-width",
          isResizing ? "transition-none select-none" : "transition-all duration-300 ease-in-out"
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
            {/* Navigation Groups */}
            <div className="px-2.5 space-y-3">
              {NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className={cn("px-2.5 mb-1.5 transition-all", isCollapsed && "lg:hidden")}>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {group.title}
                    </span>
                  </div>

                  <nav className="space-y-1" aria-label={group.title}>
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(`${item.href}`));
                      const Icon = item.icon;
                      const targetHref = searchStr ? `${item.href}?${searchStr}` : item.href;

                      return (
                        <Link
                          key={item.href}
                          href={targetHref}
                          onClick={() => onClose?.()}
                          title={item.label}
                          className={cn(
                            "flex items-center rounded-xl text-sm font-semibold transition-all duration-150 group relative",
                            isCollapsed
                              ? "px-3 py-2 lg:justify-center lg:px-0 lg:py-2"
                              : "gap-3 px-3 py-2",
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
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Resize Handle on Right Edge (Desktop only & when not collapsed) */}
        {!isCollapsed && onWidthChange && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing?.(true);
            }}
            onDoubleClick={onResetWidth}
            className="hidden lg:flex absolute top-0 right-0 w-2 h-full cursor-col-resize items-center justify-center hover:bg-orange-500/30 active:bg-orange-500/50 transition-colors z-50 group select-none"
            title={`Kéo để chỉnh độ rộng (${sidebarWidth}px) • Click đúp để đặt lại mặc định (260px)`}
          >
            <div className="w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-orange-400 group-hover:h-12 transition-all shadow-xs" />
          </div>
        )}
      </aside>
    </>
  );
}
