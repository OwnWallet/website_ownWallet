"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { PageWrapper } from "./PageWrapper";
import { Menu, Settings, LogOut, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logout } from "@/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  email: string;
  initials: string;
  children: React.ReactNode;
}

export function AppShell({ email, initials, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-foreground flex flex-col">
      {/* Responsive Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Area Offset on Desktop */}
      <div className="lg:pl-[250px] min-h-screen flex flex-col transition-all duration-200">
        {/* Sticky Top Header */}
        <header className="h-16 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-2xs">
          {/* Left: Mobile hamburger & title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden transition-colors cursor-pointer"
              aria-label="Mở menu điều hướng"
            >
              <Menu size={18} />
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                Hệ thống Quản lý Tài chính Cá nhân
              </span>
            </div>
          </div>

          {/* Right: User Dropdown Menu */}
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
                  <p className="text-xs font-bold text-foreground">Tài khoản Quản trị</p>
                  <p className="text-[11px] text-muted-foreground truncate">{email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

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
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <PageWrapper>{children}</PageWrapper>
        </main>
      </div>
    </div>
  );
}
