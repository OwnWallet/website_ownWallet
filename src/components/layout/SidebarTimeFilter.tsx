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

  function renderFilterContent(variant: "default" | "dark" = "dark") {
    return (
      <div className="space-y-2">
        {/* Period Navigator Row */}
        <div className={cn(
          "flex items-center justify-between rounded-lg p-1 shadow-2xs border",
          variant === "dark" ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
        )}>
          <button
            type="button"
            onClick={handlePrev}
            title="Kỳ trước"
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              variant === "dark" ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            )}
          >
            <ChevronLeft size={15} />
          </button>

          <span className="text-xs font-bold text-orange-500 truncate px-1">
            {displayTitle}
          </span>

          <button
            type="button"
            onClick={handleNext}
            title="Kỳ kế tiếp"
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              variant === "dark" ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            )}
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
            variant={variant}
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
            variant={variant}
            className="w-full"
          />
        </div>

        {/* Quick Presets */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => applyPeriod(thisMonth, thisYear)}
            className={cn(
              "py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center",
              currentMonth === thisMonth && currentYear === thisYear
                ? "bg-orange-500 text-white shadow-2xs font-bold"
                : variant === "dark"
                ? "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
            )}
          >
            Tháng này
          </button>

          <button
            type="button"
            onClick={() => applyPeriod(lastMonthNum, lastMonthYear)}
            className={cn(
              "py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center",
              currentMonth === lastMonthNum && currentYear === lastMonthYear
                ? "bg-orange-500 text-white shadow-2xs font-bold"
                : variant === "dark"
                ? "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
            )}
          >
            Tháng trước
          </button>

          <button
            type="button"
            onClick={() => applyPeriod("ALL", thisYear)}
            className={cn(
              "py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center",
              currentMonth === "ALL" && currentYear === thisYear
                ? "bg-orange-500 text-white shadow-2xs font-bold"
                : variant === "dark"
                ? "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
            )}
          >
            Cả năm
          </button>
        </div>
      </div>
    );
  }

  const fullFilterView = (
    <div className="mx-3 my-1.5 p-2.5 rounded-xl bg-white/5 border border-white/10 shadow-2xs">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Calendar size={14} className="text-orange-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Thời gian dữ liệu
          </span>
        </div>
        {isPending && (
          <span className="text-xs text-orange-400 font-medium animate-pulse">
            Đang tải...
          </span>
        )}
      </div>

      {renderFilterContent("dark")}
    </div>
  );

  const collapsedDropdownView = (
    <div className="px-2 mb-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          title={`Thời gian lọc: ${displayTitle}`}
          className={cn(
            "w-full rounded-xl border transition-all cursor-pointer outline-none group text-left",
            "p-2 flex items-center justify-center border-white/10 bg-white/5 hover:border-orange-400/50 hover:bg-white/10",
            isPending && "opacity-70 animate-pulse"
          )}
        >
          <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center font-extrabold text-xs border shadow-2xs bg-orange-500/20 text-orange-400 border-orange-500/30 group-hover:scale-105 transition-transform">
            <Calendar size={14} />
            <span className="text-[10px] font-black leading-none mt-0.5">
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
            <span className="text-xs font-normal text-muted-foreground">
              {currentMonth === "ALL" ? `Năm ${currentYear}` : `T${currentMonth}/${currentYear}`}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mb-2" />
          {renderFilterContent("default")}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      {isCollapsed ? (
        <>
          <div className="hidden lg:block">{collapsedDropdownView}</div>
          <div className="block lg:hidden">{fullFilterView}</div>
        </>
      ) : (
        fullFilterView
      )}
    </>
  );
}
