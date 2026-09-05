"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface Props {
  currentMonth: number | "ALL";
  currentYear: number;
  basePath?: string;
  onChange?: (month: number | "ALL", year: number) => void;
  availableYears?: number[];
  className?: string;
}

export function MonthYearSelector({
  currentMonth,
  currentYear,
  basePath,
  onChange,
  availableYears = [2024, 2025, 2026, 2027],
  className = "",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();

  function updateSelection(m: number | "ALL", y: number) {
    if (onChange) {
      onChange(m, y);
    }
    if (basePath) {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
      params.set("month", String(m));
      params.set("year", String(y));
      router.push(`${basePath}?${params.toString()}`);
    }
  }

  function handlePrev() {
    if (currentMonth === "ALL") {
      updateSelection("ALL", currentYear - 1);
    } else {
      const prevDate = new Date(currentYear, currentMonth - 2, 1);
      updateSelection(prevDate.getMonth() + 1, prevDate.getFullYear());
    }
  }

  function handleNext() {
    if (currentMonth === "ALL") {
      updateSelection("ALL", currentYear + 1);
    } else {
      const nextDate = new Date(currentYear, currentMonth, 1);
      updateSelection(nextDate.getMonth() + 1, nextDate.getFullYear());
    }
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 bg-card border border-border/80 p-3 rounded-xl shadow-2xs ${className}`}>
      {/* Month Navigation & Selector */}
      <div className="flex items-center gap-2">
        {/* Prev Button */}
        <button
          onClick={handlePrev}
          title="Kỳ trước"
          className="p-1.5 rounded-lg border border-border bg-elevated hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft size={17} />
        </button>

        {/* Current Period Badge */}
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-lg">
          <Calendar size={15} className="text-primary" />
          <span className="text-xs sm:text-sm font-bold text-primary">
            {currentMonth === "ALL"
              ? `Cả năm ${currentYear}`
              : `Tháng ${currentMonth}, ${currentYear}`}
          </span>
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          title="Kỳ kế tiếp"
          className="p-1.5 rounded-lg border border-border bg-elevated hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground transition-colors cursor-pointer"
        >
          <ChevronRight size={17} />
        </button>

        {/* Direct Month & Year Dropdowns */}
        <div className="flex items-center gap-1.5 ml-1 sm:ml-2">
          {/* Month select */}
          <select
            value={currentMonth}
            onChange={(e) => {
              const val = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
              updateSelection(val, currentYear);
            }}
            className="bg-elevated border border-border-strong rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary text-foreground cursor-pointer"
          >
            <option value="ALL">Cả năm (Tất cả tháng)</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>

          {/* Year select */}
          <select
            value={currentYear}
            onChange={(e) => {
              const y = Number(e.target.value);
              updateSelection(currentMonth, y);
            }}
            className="bg-elevated border border-border-strong rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary text-foreground cursor-pointer"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                Năm {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
        <button
          onClick={() => updateSelection(thisMonth, thisYear)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentMonth === thisMonth && currentYear === thisYear
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-elevated text-muted-foreground hover:text-foreground border border-border"
          }`}
        >
          Tháng này
        </button>

        <button
          onClick={() => {
            const lastMonthDate = new Date(thisYear, thisMonth - 2, 1);
            updateSelection(lastMonthDate.getMonth() + 1, lastMonthDate.getFullYear());
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-elevated text-muted-foreground hover:text-foreground border border-border transition-all cursor-pointer"
        >
          Tháng trước
        </button>

        <button
          onClick={() => updateSelection("ALL", thisYear)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentMonth === "ALL" && currentYear === thisYear
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-elevated text-muted-foreground hover:text-foreground border border-border"
          }`}
        >
          Cả năm nay
        </button>

        <button
          onClick={() => updateSelection("ALL", thisYear - 1)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentMonth === "ALL" && currentYear === thisYear - 1
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-elevated text-muted-foreground hover:text-foreground border border-border"
          }`}
        >
          Năm {thisYear - 1}
        </button>
      </div>
    </div>
  );
}
