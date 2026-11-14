"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { PageWrapper } from "./PageWrapper";
import {
  Menu,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  PanelLeftClose,
  PanelLeft,
  FileUp,
  Landmark,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import Link from "next/link";
import { ActiveWalletChip } from "./ActiveWalletChip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logout } from "@/actions/auth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type LayoutWidth = "adaptive" | "full" | "standard";

const LAYOUT_OPTIONS: { value: LayoutWidth; label: string }[] = [
  { value: "adaptive", label: "Tự động (khuyên dùng)" },
  { value: "full", label: "Toàn màn hình" },
  { value: "standard", label: "Cân đối (1400px)" },
];

export const MIN_SIDEBAR_WIDTH = 210;
export const MAX_SIDEBAR_WIDTH = 400;
export const DEFAULT_SIDEBAR_WIDTH = 260;

interface Props {
  email: string;
  initials: string;
  wallets?: any[];
  children: React.ReactNode;
}

export function AppShell({ email, initials, wallets = [], children }: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState<LayoutWidth>("adaptive");
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedCollapsed = localStorage.getItem("ownwallet_sidebar_collapsed") ?? localStorage.getItem("wnwallet_sidebar_collapsed");
        if (savedCollapsed !== null) {
          setIsCollapsed(savedCollapsed === "true");
        }
        const savedWidth = (localStorage.getItem("ownwallet_layout_width") ?? localStorage.getItem("wnwallet_layout_width")) as LayoutWidth;
        if (savedWidth && ["adaptive", "full", "standard"].includes(savedWidth)) {
          setLayoutWidth(savedWidth);
        }
        const savedCustomWidth = localStorage.getItem("ownwallet_sidebar_width");
        if (savedCustomWidth) {
          const parsed = parseInt(savedCustomWidth, 10);
          if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
            setSidebarWidth(parsed);
          }
        }
      } catch {
        // Ignore
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function toggleCollapse() {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ownwallet_sidebar_collapsed", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }

  function handleWidthChange(newWidth: number) {
    const clamped = Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
    setSidebarWidth(clamped);
  }

  function resetSidebarWidth() {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    try {
      localStorage.setItem("ownwallet_sidebar_width", String(DEFAULT_SIDEBAR_WIDTH));
    } catch {
      // Ignore
    }
  }

  function changeLayoutWidth(width: LayoutWidth) {
    setLayoutWidth(width);
    try {
      localStorage.setItem("ownwallet_layout_width", width);
    } catch {
      // Ignore
    }
  }

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  return (
    <div
      className="min-h-screen bg-[var(--bg-page)] text-foreground flex flex-col"
      style={{
        ["--sidebar-desktop-width" as any]: isCollapsed ? "72px" : `${sidebarWidth}px`,
      }}
    >
      {/* Responsive Collapsible Sidebar */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        isCollapsed={isCollapsed}
        wallets={wallets}
        sidebarWidth={sidebarWidth}
        onWidthChange={handleWidthChange}
        onResetWidth={resetSidebarWidth}
        isResizing={isResizing}
        setIsResizing={setIsResizing}
      />

      {/* Main Area Offset on Desktop (dynamically tracks sidebar width) */}
      <div
        className={cn(
          "min-h-screen flex flex-col sidebar-desktop-offset",
          isResizing ? "transition-none select-none" : "transition-all duration-300 ease-in-out"
        )}
      >
        {/* Sticky Top Header */}
        <header
          className={cn(
            "h-16 sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border flex items-center justify-between shadow-2xs transition-all duration-300",
            layoutWidth === "full"
              ? "px-3 sm:px-6 lg:px-8 xl:px-10"
              : isCollapsed
              ? "px-3 sm:px-8 lg:px-10 xl:px-12"
              : "px-3 sm:px-6 lg:px-8 xl:px-10"
          )}
        >
          {/* Left: Mobile hamburger & Desktop collapse toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl border border-border bg-card text-slate-700 hover:text-foreground hover:bg-muted lg:hidden transition-colors cursor-pointer flex items-center justify-center shrink-0"
              aria-label="Mở menu điều hướng"
            >
              <Menu size={18} />
            </button>

            {/* Desktop Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={toggleCollapse}
              title={
                isCollapsed
                  ? "Mở rộng thanh bên (Ctrl+B)"
                  : "Thu gọn thanh bên (Ctrl+B)"
              }
              className={cn(
                "hidden lg:flex items-center justify-center p-2 rounded-xl border transition-all cursor-pointer shadow-2xs",
                isCollapsed
                  ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100/80"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
              aria-label="Toggle sidebar"
            >
              {isCollapsed ? (
                <PanelLeft size={16} className="text-orange-600" />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </button>

            {/* Persisted wallet filter, visible on every page */}
            <ActiveWalletChip wallets={wallets} />
          </div>

          {/* Right: Quick actions & User Dropdown Menu */}
          <div className="flex items-center gap-3">
            {/* Quick Add Transaction Button */}
            <Link
              href="/transactions/new"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all active:scale-95"
            >
              <Plus size={14} />
              <span>Giao dịch mới</span>
            </Link>

            {/* Quick Import Button */}
            <Link
              href="/import"
              className="hidden sm:inline-flex items-center justify-center gap-1.5 p-2 lg:px-3 lg:py-1.5 rounded-xl border border-border bg-card hover:bg-muted/70 text-slate-700 hover:text-foreground text-xs font-semibold shadow-2xs transition-all"
              title="Import sao kê"
              aria-label="Import sao kê"
            >
              <FileUp size={15} className="text-orange-600" />
              <span className="hidden lg:inline">Import</span>
            </Link>

            {/* User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2.5 py-1 px-2.5 rounded-full border border-border bg-card hover:bg-slate-50 transition-all cursor-pointer shadow-xs outline-none">
                <Avatar className="w-7 h-7 text-[11px] font-bold bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                  <AvatarFallback className="bg-transparent text-white font-bold">
                    {initials || "AD"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-slate-700 max-w-[140px] truncate hidden md:inline">
                  {email}
                </span>
                <ChevronDown size={14} className="text-muted-foreground hidden sm:inline" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-lg border-border bg-card">
                <DropdownMenuLabel className="font-normal px-2 py-1.5">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-xs font-bold text-foreground">Tài khoản của tôi</p>
                    <p className="text-[11px] text-muted-foreground truncate">{email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem className="p-0">
                  <Link href="/wallets" className="flex items-center gap-2 text-xs w-full px-2 py-1.5 cursor-pointer">
                    <Landmark size={14} className="text-muted-foreground" />
                    <span>Quản lý Tài khoản</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem className="p-0">
                  <Link href="/settings" className="flex items-center gap-2 text-xs w-full px-2 py-1.5 cursor-pointer">
                    <Settings size={14} className="text-muted-foreground" />
                    <span>Cài đặt hệ thống</span>
                  </Link>
                </DropdownMenuItem>

                {/* Layout width (desktop-only preference, moved out of the header) */}
                <div className="hidden lg:block">
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 px-2 py-1">
                    <SlidersHorizontal size={12} />
                    Độ rộng nội dung
                  </DropdownMenuLabel>
                  {LAYOUT_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => changeLayoutWidth(opt.value)}
                      className={cn(
                        "flex items-center gap-2 text-xs px-2 py-1.5 cursor-pointer",
                        layoutWidth === opt.value && "font-semibold text-orange-900"
                      )}
                    >
                      <span className="w-3.5 flex justify-center text-orange-600 shrink-0">
                        {layoutWidth === opt.value && <Check size={13} />}
                      </span>
                      <span>{opt.label}</span>
                    </DropdownMenuItem>
                  ))}
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem variant="destructive" className="p-0">
                  <form action={logout} className="w-full">
                    <button type="submit" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 text-rose-600 cursor-pointer">
                      <LogOut size={14} />
                      <span>Đăng xuất</span>
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Area — Dynamically Adapts to Sidebar & Layout Mode */}
        <main
          className={cn(
            "flex-1 w-full mx-auto transition-all duration-300 ease-in-out",
            layoutWidth === "full"
              ? "max-w-none px-3 sm:px-6 lg:px-8 xl:px-10 pt-4 pb-24 md:py-6"
              : layoutWidth === "standard"
              ? "max-w-[1400px] px-3 sm:px-6 lg:px-8 pt-4 pb-24 md:py-6"
              : isCollapsed
              ? "max-w-[1920px] 2xl:max-w-full px-3 sm:px-8 lg:px-10 xl:px-12 2xl:px-14 pt-4 pb-24 md:py-6"
              : "max-w-[1600px] 2xl:max-w-[1720px] px-3 sm:px-6 lg:px-8 xl:px-10 pt-4 pb-24 md:py-6"
          )}
        >
          <PageWrapper>{children}</PageWrapper>
        </main>

        {/* Mobile Floating Action Button (FAB) — Thêm nhanh giao dịch 1 chạm */}
        <Link
          href="/transactions/new"
          aria-label="Thêm giao dịch mới"
          title="Thêm giao dịch mới"
          className="md:hidden fixed bottom-5 right-5 z-30 flex items-center gap-1.5 px-4 py-3 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 text-white text-xs font-bold shadow-lg shadow-orange-600/30 active:scale-95 transition-transform"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>Giao dịch</span>
        </Link>
      </div>
    </div>
  );
}
