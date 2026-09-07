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
  Sparkles,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import Link from "next/link";
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
    <div className="min-h-screen bg-[var(--bg-page)] text-foreground flex flex-col">
      {/* Responsive Collapsible Sidebar */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
        wallets={wallets}
      />

      {/* Main Area Offset on Desktop (smooth transition 250px <-> 72px) */}
      <div
        className={cn(
          "min-h-screen flex flex-col transition-all duration-300 ease-in-out",
          isCollapsed ? "lg:pl-[72px]" : "lg:pl-[250px]"
        )}
      >
        {/* Sticky Top Header */}
        <header
          className={cn(
            "h-16 sticky top-0 z-30 bg-card/85 backdrop-blur-md border-b border-border flex items-center justify-between shadow-2xs transition-all duration-300",
            layoutWidth === "full"
              ? "px-4 sm:px-6 lg:px-8 xl:px-10"
              : isCollapsed
              ? "px-4 sm:px-8 lg:px-10 xl:px-12"
              : "px-4 sm:px-6 lg:px-8 xl:px-10"
          )}
        >
          {/* Left: Mobile hamburger & Desktop collapse toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden transition-colors cursor-pointer"
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

            {/* Layout Width Customizer Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                title={
                  layoutWidth === "full"
                    ? "Độ rộng giao diện: Toàn màn hình"
                    : layoutWidth === "standard"
                    ? "Độ rộng giao diện: Tiêu chuẩn (1400px)"
                    : "Độ rộng giao diện: Rộng thích ứng"
                }
                className="hidden sm:inline-flex items-center justify-center p-2 rounded-xl border border-border bg-card hover:bg-muted/80 text-muted-foreground hover:text-foreground shadow-2xs transition-all cursor-pointer outline-none"
              >
                <SlidersHorizontal size={15} className="text-orange-600" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 p-1.5 shadow-lg border-border bg-card">
                <DropdownMenuLabel className="font-semibold text-xs px-2 py-1 text-foreground">
                  Tùy biến độ rộng giao diện
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => changeLayoutWidth("adaptive")}
                  className={cn(
                    "flex items-start gap-2.5 p-2 rounded-lg cursor-pointer",
                    layoutWidth === "adaptive" ? "bg-orange-50/80 text-orange-900" : ""
                  )}
                >
                  <div className="mt-0.5 w-4 h-4 flex items-center justify-center text-orange-600 shrink-0">
                    {layoutWidth === "adaptive" && <Check size={14} className="font-bold" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>⚡ Tự động thích ứng</span>
                      <span className="text-[9px] font-semibold bg-orange-100 text-orange-700 px-1 rounded">
                        Khuyên dùng
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Bung rộng tối đa khi tắt thanh bên; rộng thoáng khi bật thanh bên.
                    </p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => changeLayoutWidth("full")}
                  className={cn(
                    "flex items-start gap-2.5 p-2 rounded-lg cursor-pointer",
                    layoutWidth === "full" ? "bg-orange-50/80 text-orange-900" : ""
                  )}
                >
                  <div className="mt-0.5 w-4 h-4 flex items-center justify-center text-orange-600 shrink-0">
                    {layoutWidth === "full" && <Check size={14} className="font-bold" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">🖥️ Toàn màn hình (100% Fluid)</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Luôn tràn 100% chiều ngang màn hình không giới hạn max-width.
                    </p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => changeLayoutWidth("standard")}
                  className={cn(
                    "flex items-start gap-2.5 p-2 rounded-lg cursor-pointer",
                    layoutWidth === "standard" ? "bg-orange-50/80 text-orange-900" : ""
                  )}
                >
                  <div className="mt-0.5 w-4 h-4 flex items-center justify-center text-orange-600 shrink-0">
                    {layoutWidth === "standard" && <Check size={14} className="font-bold" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">📐 Cân đối (1400px)</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Cố định độ rộng vừa phải ở giữa màn hình cho các màn hình siêu lớn.
                    </p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

            {/* Quick AI Import Button */}
            <Link
              href="/import"
              className="hidden sm:inline-flex items-center justify-center p-2 rounded-xl border border-border bg-card hover:bg-muted/70 text-muted-foreground hover:text-foreground shadow-2xs transition-all"
              title="Import sao kê tự động (AI)"
            >
              <Sparkles size={15} className="text-amber-500" />
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
                    <span className="text-sm">💳</span>
                    <span>Quản lý Tài khoản</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem className="p-0">
                  <Link href="/settings" className="flex items-center gap-2 text-xs w-full px-2 py-1.5 cursor-pointer">
                    <Settings size={14} className="text-muted-foreground" />
                    <span>Cài đặt hệ thống</span>
                  </Link>
                </DropdownMenuItem>

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
              ? "max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 py-6"
              : layoutWidth === "standard"
              ? "max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6"
              : isCollapsed
              ? "max-w-[1920px] 2xl:max-w-full px-4 sm:px-8 lg:px-10 xl:px-12 2xl:px-14 py-6"
              : "max-w-[1600px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-8 xl:px-10 py-6"
          )}
        >
          <PageWrapper>{children}</PageWrapper>
        </main>
      </div>
    </div>
  );
}
