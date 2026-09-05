import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeData } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { TransactionList } from "./transaction-list";

export const metadata: Metadata = { title: "Giao dịch | wnWallet" };

interface TransactionsPageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const resolvedSearchParams = (await searchParams) || {};
  let initialMonth: number | "ALL" | undefined = undefined;
  if (resolvedSearchParams.month) {
    if (resolvedSearchParams.month === "ALL" || resolvedSearchParams.month === "all") {
      initialMonth = "ALL";
    } else {
      const parsed = parseInt(resolvedSearchParams.month, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
        initialMonth = parsed;
      }
    }
  }

  let initialYear: number | "ALL" | undefined = undefined;
  if (resolvedSearchParams.year) {
    if (resolvedSearchParams.year === "ALL" || resolvedSearchParams.year === "all") {
      initialYear = "ALL";
    } else {
      const parsed = parseInt(resolvedSearchParams.year, 10);
      if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2100) {
        initialYear = parsed;
      }
    }
  }

  let transactions: any[] = [];
  let categories: any[] = [];

  try {
    const [txs, cats] = await Promise.all([
      db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .include("category", (cat) => cat)
        .orderBy((t) => t.recordedAt.desc())
        .limit(2000)
        .all(),
      db.orm.public.Category
        .where((c) => c.userId.eq(userId))
        .orderBy((c) => c.name.asc())
        .all(),
    ]);
    transactions = serializeData(txs);
    categories = serializeData(cats);
  } catch (err) {
    console.error("Failed to load transactions:", err);
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lịch sử giao dịch</h1>
          <p className="text-muted text-sm mt-1">
            Tổng cộng {transactions.length} giao dịch gần nhất
          </p>
        </div>
        <Link href="/transactions/new" className="btn-primary">
          <Plus size={16} /> Thêm giao dịch mới
        </Link>
      </div>

      {/* Transaction List with filters, search, edit & delete */}
      <TransactionList
        initialTransactions={transactions}
        categories={categories}
        initialMonth={initialMonth}
        initialYear={initialYear}
      />
    </div>
  );
}
