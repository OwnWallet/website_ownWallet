import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ReportClient } from "./report-client";
import { getWallets } from "@/actions/wallets";
import { toInstant, toDate, getFilterDateRange, getVNDateParts } from "@/lib/utils";

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
  const cookieStore = await cookies();
  const savedCookieWallet = cookieStore.get("ownwallet_selected_wallet")?.value;
  const walletId = resolvedSearchParams.wallet || savedCookieWallet || "ALL";
  const isYearly = filterDate.month === "ALL";

  const startCurrent = filterDate.from;
  const endCurrent = filterDate.to;

  const prevRange = isYearly
    ? getFilterDateRange("ALL", filterDate.year - 1)
    : getFilterDateRange(
        (filterDate.month as number) === 1 ? 12 : (filterDate.month as number) - 1,
        (filterDate.month as number) === 1 ? filterDate.year - 1 : filterDate.year
      );
  const startPrevious = prevRange.from;
  const endPrevious = prevRange.to;

  const endCurrentInstant = toInstant(endCurrent);

  try {
    let txQuery = db.orm.public.Transaction
      .where((t) => t.userId.eq(userId))
      .where((t) => t.recordedAt.lte(endCurrentInstant));

    if (walletId && walletId !== "ALL") {
      if (walletId === "UNASSIGNED") {
        txQuery = txQuery.where({ walletId: null });
      } else {
        txQuery = txQuery.where({ walletId });
      }
    }

    const [categories, txs, wallets] = await Promise.all([
      db.orm.public.Category
        .where((c) => c.userId.eq(userId))
        .all(),
      txQuery.all(),
      getWallets(),
    ]);

    let currentIncome = 0;
    let currentExpense = 0;
    let lastIncome = 0;
    let lastExpense = 0;
    let allPriorIncome = 0;
    let allPriorExpense = 0;

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
        const d = new Date(Date.UTC(yr, m - 1 - i, 1));
        const label = `T${d.getUTCMonth() + 1}/${d.getUTCFullYear().toString().slice(-2)}`;
        monthlyMap[label] = { month: label, income: 0, expense: 0 };
      }
    }

    const startCurrentMs = startCurrent.getTime();
    const endCurrentMs = endCurrent.getTime();
    const startPrevMs = startPrevious.getTime();
    const endPrevMs = endPrevious.getTime();

    txs.forEach((tx: any) => {
      const recDate = toDate(tx.recordedAt);
      const recMs = recDate.getTime();
      const { year: txY, month: txM } = getVNDateParts(tx.recordedAt);
      const amt = Number(tx.amount);
      const isIncome = tx.type === "INCOME";

      if (recMs < startCurrentMs) {
        if (isIncome) allPriorIncome += amt;
        else allPriorExpense += amt;
      }

      // Current Period
      if (recMs >= startCurrentMs && recMs <= endCurrentMs) {
        if (isIncome) currentIncome += amt;
        else {
          currentExpense += amt;
          categorySpentMap.set(tx.categoryId, (categorySpentMap.get(tx.categoryId) || 0) + amt);
        }

        if (isYearly) {
          const mLabel = `T${txM}`;
          if (monthlyMap[mLabel]) {
            if (isIncome) monthlyMap[mLabel].income += amt;
            else monthlyMap[mLabel].expense += amt;
          }
        }
      }

      // Previous Period
      if (recMs >= startPrevMs && recMs <= endPrevMs) {
        if (isIncome) lastIncome += amt;
        else lastExpense += amt;
      }

      // Trend for monthly view
      if (!isYearly) {
        const label = `T${txM}/${txY.toString().slice(-2)}`;
        if (monthlyMap[label]) {
          if (isIncome) monthlyMap[label].income += amt;
          else monthlyMap[label].expense += amt;
        }
      }
    });

    const initialWalletBalance = (wallets as any[]).reduce((sum, w) => {
      if (!walletId || walletId === "ALL") return sum + Number(w.balance ?? 0);
      if (walletId === "UNASSIGNED") return 0;
      return w.id === walletId ? sum + Number(w.balance ?? 0) : sum;
    }, 0);

    const openingCumulativeBalance = initialWalletBalance + (allPriorIncome - allPriorExpense);
    const closingCumulativeBalance = openingCumulativeBalance + (currentIncome - currentExpense);

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
        openingCumulativeBalance={openingCumulativeBalance}
        closingCumulativeBalance={closingCumulativeBalance}
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
