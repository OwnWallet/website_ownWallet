import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ReportClient } from "./report-client";
import { toInstant } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Báo cáo & Phân tích — wnWallet",
};

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
  const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

  const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
  const endOfLastMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

  const startOf6MonthsAgo = new Date(currentYear, currentMonth - 5, 1);
  const sixMonthsInstant = toInstant(startOf6MonthsAgo);

  try {
    const [categories, sixMonthsTxs] = await Promise.all([
      db.orm.public.Category
        .where((c) => c.userId.eq(userId))
        .all(),
      db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .where((t) => t.recordedAt.gte(sixMonthsInstant))
        .all(),
    ]);

    let currentIncome = 0;
    let currentExpense = 0;
    let lastIncome = 0;
    let lastExpense = 0;

    const categorySpentMap = new Map<string, number>();

    // 6-month monthly map
    const monthlyMap: Record<string, { month: string; income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const label = `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
      monthlyMap[label] = { month: label, income: 0, expense: 0 };
    }

    sixMonthsTxs.forEach((tx: any) => {
      const recDate = new Date(tx.recordedAt);
      const amt = Number(tx.amount);
      const isIncome = tx.type === "INCOME";

      // Current Month
      if (recDate >= startOfCurrentMonth && recDate <= endOfCurrentMonth) {
        if (isIncome) currentIncome += amt;
        else {
          currentExpense += amt;
          categorySpentMap.set(tx.categoryId, (categorySpentMap.get(tx.categoryId) || 0) + amt);
        }
      }

      // Last Month
      if (recDate >= startOfLastMonth && recDate <= endOfLastMonth) {
        if (isIncome) lastIncome += amt;
        else lastExpense += amt;
      }

      // Trend
      const label = `T${recDate.getMonth() + 1}/${recDate.getFullYear().toString().slice(-2)}`;
      if (monthlyMap[label]) {
        if (isIncome) monthlyMap[label].income += amt;
        else monthlyMap[label].expense += amt;
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
    const currentMonthLabel = `Tháng ${currentMonth + 1}/${currentYear}`;

    return (
      <ReportClient
        currentMonthName={currentMonthLabel}
        currentMonthIncome={currentIncome}
        currentMonthExpense={currentExpense}
        lastMonthIncome={lastIncome}
        lastMonthExpense={lastExpense}
        categorySpending={categorySpending}
        monthlyTrend={monthlyTrend}
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
