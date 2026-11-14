"use client";

import { useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import type { WalletItem } from "./SidebarWalletSelector";

const COOKIE = "ownwallet_selected_wallet";

const noopSubscribe = () => () => {};

function readWalletCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Header chip that makes the persisted wallet filter visible on every page
 * (the selection lives in a 30-day cookie, so it can otherwise silently filter data).
 */
export function ActiveWalletChip({ wallets = [] }: { wallets?: WalletItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const urlWallet = searchParams?.get("wallet") ?? null;

  // Server snapshot is null so hydration matches; the client then reads the cookie.
  // It is re-read on each render, and navigation re-renders via useSearchParams.
  const cookieWallet = useSyncExternalStore(noopSubscribe, readWalletCookie, () => null);

  const selectedId = urlWallet || cookieWallet || "ALL";
  if (selectedId === "ALL") return null;

  const name =
    selectedId === "UNASSIGNED"
      ? "Chưa gán tài khoản"
      : wallets.find((w) => w.id === selectedId)?.name;
  if (!name) return null;

  function clear() {
    document.cookie = `${COOKIE}=; path=/; max-age=0`;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("wallet");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-orange-200 bg-orange-50 text-orange-800 text-xs font-semibold max-w-[220px] sm:max-w-[280px]"
      aria-live="polite"
    >
      <Filter size={12} className="shrink-0" aria-hidden="true" />
      <span className="truncate">
        <span className="hidden sm:inline font-medium text-orange-700">Đang lọc: </span>
        {name}
      </span>
      <button
        type="button"
        onClick={clear}
        disabled={isPending}
        aria-label={`Bỏ lọc tài khoản ${name}`}
        title="Xem tất cả tài khoản"
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 hover:bg-orange-200/70 transition-colors cursor-pointer disabled:opacity-50"
      >
        <X size={12} />
      </button>
    </div>
  );
}
