import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeData } from "@/lib/utils";
import { Plus, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { TransactionList } from "./transaction-list";

interface TransactionsPageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
    wallet?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const resolvedSearchParams = (await searchParams) || {};
  const initialWallet = resolvedSearchParams.wallet || "ALL";
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
  let wallets: any[] = [];

  try {
    const [txs, cats, rawWallets] = await Promise.all([
      db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .include("category", (cat) => cat)
        .include("wallet", (w) => w)
        .orderBy((t) => t.recordedAt.desc())
        .limit(2000)
        .all(),
      db.orm.public.Category
        .where((c) => c.userId.eq(userId))
        .orderBy((c) => c.name.asc())
        .all(),
      db.orm.public.Wallet
        .where((w) => w.userId.eq(userId))
        .orderBy((w) => w.createdAt.asc())
        .all(),
    ]);

    transactions = serializeData(txs);
    categories = serializeData(cats);
    wallets = serializeData(rawWallets);
  } catch (err) {
    console.error("Failed to load transactions:", err);
  }

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-sm">
            <ArrowLeftRight size={20} />
          </div>
          <div>
            <h1 className="page-header-title">Lịch sử giao dịch</h1>
            <p className="page-header-subtitle">
              Tổng cộng {transactions.length} giao dịch gần nhất
            </p>
          </div>
        </div>
        <Link href="/transactions/new" className="btn-primary">
          <Plus size={16} /> Thêm giao dịch mới
        </Link>
      </div>

      {/* Transaction List with filters, search, edit & delete */}
      <TransactionList
        initialTransactions={transactions}
        categories={categories}
        wallets={wallets}
        initialMonth={initialMonth}
        initialYear={initialYear}
        initialWallet={initialWallet}
      />
    </div>
  );
}
