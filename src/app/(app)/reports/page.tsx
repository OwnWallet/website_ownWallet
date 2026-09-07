import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ReportClient } from "./report-client";
import { toInstant, toDate, getFilterDateRange } from "@/lib/utils";


interface ReportsPageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
    wallet?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const resolvedSearchParams = (await searchParams) || {};
  const filterDate = getFilterDateRange(resolvedSearchParams.month, resolvedSearchParams.year);
  const walletId = resolvedSearchParams.wallet || "ALL";
  const isYearly = filterDate.month === "ALL";

  let startCurrent: Date;
  let endCurrent: Date;
  let startPrevious: Date;
  let endPrevious: Date;
  let historyStart: Date;

  if (isYearly) {
    const yr = filterDate.year;
    startCurrent = new Date(yr, 0, 1, 0, 0, 0, 0);
    endCurrent = new Date(yr, 11, 31, 23, 59, 59, 999);
    startPrevious = new Date(yr - 1, 0, 1, 0, 0, 0, 0);
    endPrevious = new Date(yr - 1, 11, 31, 23, 59, 59, 999);
    historyStart = startPrevious;
  } else {
    const yr = filterDate.year;
    const m = filterDate.month as number; // 1-indexed
    startCurrent = new Date(yr, m - 1, 1, 0, 0, 0, 0);
    endCurrent = new Date(yr, m, 0, 23, 59, 59, 999);
    startPrevious = new Date(yr, m - 2, 1, 0, 0, 0, 0);
    endPrevious = new Date(yr, m - 1, 0, 23, 59, 59, 999);
    historyStart = new Date(yr, m - 6, 1, 0, 0, 0, 0);
  }

  const historyInstant = toInstant(historyStart);
  const endCurrentInstant = toInstant(endCurrent);

  try {
    let txQuery = db.orm.public.Transaction
      .where((t) => t.userId.eq(userId))
      .where((t) => t.recordedAt.gte(historyInstant))
      .where((t) => t.recordedAt.lte(endCurrentInstant));

    if (walletId && walletId !== "ALL") {
      if (walletId === "UNASSIGNED") {
        txQuery = txQuery.where({ walletId: null });
      } else {
        txQuery = txQuery.where({ walletId });
      }
    }

    const [categories, txs] = await Promise.all([
      db.orm.public.Category
        .where((c) => c.userId.eq(userId))
        .all(),
      txQuery.all(),
    ]);

    let currentIncome = 0;
    let currentExpense = 0;
    let lastIncome = 0;
    let lastExpense = 0;

    const categorySpentMap = new Map<string, number>();

    // Trend map
    const monthlyMap: Record<string, { month: string; income: number; expense: number }> = {};
    if (isYearly) {
      for (let i = 1; i <= 12; i++) {
        const label = `T${i}`;
        monthlyMap[label] = { month: label, income: 0, expense: 0 };
      }
    } else {
      const m = filterDate.month as number;
      const yr = filterDate.year;
      for (let i = 5; i >= 0; i--) {
        const d = new Date(yr, m - 1 - i, 1);
        const label = `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
        monthlyMap[label] = { month: label, income: 0, expense: 0 };
      }
    }

    txs.forEach((tx: any) => {
      const recDate = toDate(tx.recordedAt);
      const amt = Number(tx.amount);
      const isIncome = tx.type === "INCOME";

      // Current Period
      if (recDate >= startCurrent && recDate <= endCurrent) {
        if (isIncome) currentIncome += amt;
        else {
          currentExpense += amt;
          categorySpentMap.set(tx.categoryId, (categorySpentMap.get(tx.categoryId) || 0) + amt);
        }

        if (isYearly) {
          const mLabel = `T${recDate.getMonth() + 1}`;
          if (monthlyMap[mLabel]) {
            if (isIncome) monthlyMap[mLabel].income += amt;
            else monthlyMap[mLabel].expense += amt;
          }
        }
      }

      // Previous Period
      if (recDate >= startPrevious && recDate <= endPrevious) {
        if (isIncome) lastIncome += amt;
        else lastExpense += amt;
      }

      // Trend for monthly view
      if (!isYearly) {
        const label = `T${recDate.getMonth() + 1}/${recDate.getFullYear().toString().slice(-2)}`;
        if (monthlyMap[label]) {
          if (isIncome) monthlyMap[label].income += amt;
          else monthlyMap[label].expense += amt;
        }
      }
    });

    const catMap = new Map(categories.map((c: any) => [c.id, c]));
    const categorySpending = Array.from(categorySpentMap.entries())
      .map(([catId, total]) => {
        const cat = catMap.get(catId);
        return {
          name: cat?.name || "Khác",
          value: total,
          color: cat?.color || "#ea580c",
          icon: cat?.icon || "📁",
        };
      })
      .sort((a, b) => b.value - a.value);

    const monthlyTrend = Object.values(monthlyMap);

    return (
      <ReportClient
        currentMonthName={filterDate.label}
        currentMonthIncome={currentIncome}
        currentMonthExpense={currentExpense}
        lastMonthIncome={lastIncome}
        lastMonthExpense={lastExpense}
        categorySpending={categorySpending}
        monthlyTrend={monthlyTrend}
        currentMonth={filterDate.month}
        currentYear={filterDate.year}
        isYearly={isYearly}
      />
    );
  } catch (error) {
    console.error("Failed to load reports data:", error);
    return (
      <div className="card text-center text-danger py-12">
        <p>Đã xảy ra lỗi khi tải dữ liệu báo cáo.</p>
      </div>
    );
  }
}
