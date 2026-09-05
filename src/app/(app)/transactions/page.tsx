import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeData } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { TransactionList } from "./transaction-list";

export const metadata: Metadata = { title: "Giao dịch | wnWallet" };

export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  let transactions: any[] = [];
  let categories: any[] = [];

  try {
    const [txs, cats] = await Promise.all([
      db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .include("category", (cat) => cat)
        .orderBy((t) => t.recordedAt.desc())
        .limit(200)
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
      />
    </div>
  );
}
