"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useTransition } from "react";
import { StyledSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Props {
  isCollapsed?: boolean;
  onClose?: () => void;
}

export function SidebarTimeFilter({ isCollapsed = false, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();

  // Parse current month and year from searchParams
  const monthParam = searchParams ? searchParams.get("month") : null;
  const yearParam = searchParams ? searchParams.get("year") : null;

  let currentMonth: number | "ALL" = thisMonth;
  if (monthParam === "ALL" || monthParam === "all") {
    currentMonth = "ALL";
  } else if (monthParam) {
    const parsed = parseInt(monthParam, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
      currentMonth = parsed;
    }
  }

  let currentYear: number = thisYear;
  if (yearParam) {
    const parsedY = parseInt(yearParam, 10);
    if (!isNaN(parsedY) && parsedY >= 2020 && parsedY <= 2100) {
      currentYear = parsedY;
    }
  }

  function applyPeriod(m: number | "ALL", y: number) {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.set("month", String(m));
    params.set("year", String(y));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
      onClose?.();
    });
  }

  function handlePrev() {
    if (currentMonth === "ALL") {
      applyPeriod("ALL", currentYear - 1);
    } else {
      const prevDate = new Date(currentYear, currentMonth - 2, 1);
      applyPeriod(prevDate.getMonth() + 1, prevDate.getFullYear());
    }
  }

  function handleNext() {
    if (currentMonth === "ALL") {
      applyPeriod("ALL", currentYear + 1);
    } else {
      const nextDate = new Date(currentYear, currentMonth, 1);
      applyPeriod(nextDate.getMonth() + 1, nextDate.getFullYear());
    }
  }

  const lastMonthDate = new Date(thisYear, thisMonth - 2, 1);
  const lastMonthNum = lastMonthDate.getMonth() + 1;
  const lastMonthYear = lastMonthDate.getFullYear();

  const availableYears = [2023, 2024, 2025, 2026, 2027, 2028];

  const displayTitle =
    currentMonth === "ALL"
      ? `Cả năm ${currentYear}`
      : `Tháng ${currentMonth}/${currentYear}`;

  const filterContent = (
    <div className="space-y-2">
      {/* Period Navigator Row */}
      <div className="flex items-center justify-between bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1 shadow-2xs">
        <button
          type="button"
          onClick={handlePrev}
          title="Kỳ trước"
          className="p-1 rounded text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
        >
          <ChevronLeft size={15} />
        </button>

        <span className="text-xs font-bold text-orange-700 truncate px-1">
          {displayTitle}
        </span>

        <button
          type="button"
          onClick={handleNext}
          title="Kỳ kế tiếp"
          className="p-1 rounded text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Selectors Row */}
      <div className="grid grid-cols-2 gap-1.5">
        <StyledSelect
          value={String(currentMonth)}
          onChange={(val) => {
            const parsedVal = val === "ALL" ? "ALL" : Number(val);
            applyPeriod(parsedVal, currentYear);
          }}
          options={[
            { value: "ALL", label: "Cả năm" },
            ...Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1),
              label: `Tháng ${i + 1}`,
            })),
          ]}
          size="sm"
          className="w-full"
        />

        <StyledSelect
          value={String(currentYear)}
          onChange={(val) => {
            applyPeriod(currentMonth, Number(val));
          }}
          options={availableYears.map((yr) => ({
            value: String(yr),
            label: `Năm ${yr}`,
          }))}
          size="sm"
          className="w-full"
        />
      </div>

      {/* Quick Presets */}
      <div className="grid grid-cols-3 gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => applyPeriod(thisMonth, thisYear)}
          className={cn(
            "py-1 px-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer text-center",
            currentMonth === thisMonth && currentYear === thisYear
              ? "bg-orange-600 text-white shadow-2xs font-bold"
              : "bg-[var(--bg-card)] text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] border border-[var(--border)]"
          )}
        >
          Tháng này
        </button>

        <button
          type="button"
          onClick={() => applyPeriod(lastMonthNum, lastMonthYear)}
          className={cn(
            "py-1 px-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer text-center",
            currentMonth === lastMonthNum && currentYear === lastMonthYear
              ? "bg-orange-600 text-white shadow-2xs font-bold"
              : "bg-[var(--bg-card)] text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] border border-[var(--border)]"
          )}
        >
          Tháng trước
        </button>

        <button
          type="button"
          onClick={() => applyPeriod("ALL", thisYear)}
          className={cn(
            "py-1 px-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer text-center",
            currentMonth === "ALL" && currentYear === thisYear
              ? "bg-orange-600 text-white shadow-2xs font-bold"
              : "bg-[var(--bg-card)] text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] border border-[var(--border)]"
          )}
        >
          Cả năm
        </button>
      </div>
    </div>
  );

  if (isCollapsed) {
    return (
      <div className="px-2 mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            title={`Thời gian lọc: ${displayTitle}`}
            className={cn(
              "w-full rounded-xl border transition-all cursor-pointer outline-none group text-left",
              "p-2 flex items-center justify-center border-border hover:border-orange-300 hover:bg-orange-50/50",
              isPending && "opacity-70 animate-pulse"
            )}
          >
            <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center font-extrabold text-[10px] border shadow-2xs bg-orange-50 text-orange-700 border-orange-200 group-hover:scale-105 transition-transform">
              <Calendar size={13} />
              <span className="text-[9px] font-black leading-none mt-0.5">
                {currentMonth === "ALL" ? "NĂM" : `T${currentMonth}`}
              </span>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="right"
            className="w-72 p-3 shadow-xl border-border bg-card"
          >
            <DropdownMenuLabel className="font-semibold text-xs px-1 py-1 text-foreground flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-orange-600" />
                <span>Thời gian dữ liệu</span>
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {currentMonth === "ALL" ? `Năm ${currentYear}` : `T${currentMonth}/${currentYear}`}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mb-2" />
            {filterContent}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="mx-3 my-1.5 p-2.5 rounded-xl bg-[var(--bg-elevated)]/90 border border-[var(--border)] shadow-2xs">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[var(--fg)]">
          <Calendar size={13} className="text-orange-600" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            Thời gian dữ liệu
          </span>
        </div>
        {isPending && (
          <span className="text-[10px] text-orange-600 font-medium animate-pulse">
            Đang tải...
          </span>
        )}
      </div>

      {filterContent}
    </div>
  );
}
