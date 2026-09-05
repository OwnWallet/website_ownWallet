"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useTransition } from "react";

interface Props {
  onClose?: () => void;
}

export function SidebarTimeFilter({ onClose }: Props) {
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

  const availableYears = [2023, 2024, 2025, 2026, 2027, 2028];

  const displayTitle =
    currentMonth === "ALL"
      ? `Cả năm ${currentYear}`
      : `Tháng ${currentMonth}/${currentYear}`;

  return (
    <div className="mx-3 my-2.5 p-2.5 rounded-xl bg-slate-50/90 border border-slate-200 shadow-2xs">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Calendar size={13} className="text-orange-600" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Thời gian dữ liệu
          </span>
        </div>
        {isPending && (
          <span className="text-[10px] text-orange-600 font-medium animate-pulse">
            Đang tải...
          </span>
        )}
      </div>

      {/* Period Navigator Row */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-1 mb-2 shadow-2xs">
        <button
          type="button"
          onClick={handlePrev}
          title="Kỳ trước"
          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
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
          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Selectors Row */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <select
          value={currentMonth}
          onChange={(e) => {
            const val = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
            applyPeriod(val, currentYear);
          }}
          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-orange-500 cursor-pointer shadow-2xs"
        >
          <option value="ALL">Cả năm</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              Tháng {m}
            </option>
          ))}
        </select>

        <select
          value={currentYear}
          onChange={(e) => {
            applyPeriod(currentMonth, Number(e.target.value));
          }}
          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-orange-500 cursor-pointer shadow-2xs"
        >
          {availableYears.map((yr) => (
            <option key={yr} value={yr}>
              Năm {yr}
            </option>
          ))}
        </select>
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => applyPeriod(thisMonth, thisYear)}
          className={`flex-1 py-1 px-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer text-center ${
            currentMonth === thisMonth && currentYear === thisYear
              ? "bg-orange-600 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Tháng này
        </button>

        <button
          type="button"
          onClick={() => applyPeriod("ALL", thisYear)}
          className={`flex-1 py-1 px-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer text-center ${
            currentMonth === "ALL" && currentYear === thisYear
              ? "bg-orange-600 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Cả năm nay
        </button>
      </div>
    </div>
  );
}
