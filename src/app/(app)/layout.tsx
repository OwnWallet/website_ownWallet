import { NAV_ITEMS } from "@/lib/constants";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        style={{ width: "var(--sidebar-width)" }}
        className="fixed top-0 left-0 h-full bg-[var(--background-card)] border-r border-[var(--border-strong)] flex flex-col z-40"
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-[var(--border-strong)]">
          <span className="text-xl font-bold text-[var(--primary)]">wnWallet</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--foreground-muted)] hover:bg-[var(--background-hover)] hover:text-[var(--foreground)] transition-colors"
            >
              <span className="text-base">●</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-[var(--border-strong)]">
          <p className="text-xs text-[var(--foreground-subtle)] px-3">wnWallet v0.1</p>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{ marginLeft: "var(--sidebar-width)" }}
        className="flex-1 min-h-screen p-6 animate-fade-in"
      >
        {children}
      </main>
    </div>
  );
}
