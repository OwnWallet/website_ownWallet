import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeData } from "@/lib/utils";
import { NewTransactionForm } from "./transaction-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Thêm giao dịch | OwnWallet" };

export default async function NewTransactionPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  let categories: any[] = [];
  let wallets: any[] = [];
  try {
    const [cats, rawWallets] = await Promise.all([
      db.orm.public.Category
        .where((c) => c.userId.eq(session.user.id))
        .orderBy((c) => c.name.asc())
        .all(),
      db.orm.public.Wallet
        .where((w) => w.userId.eq(session.user.id))
        .orderBy((w) => w.createdAt.asc())
        .all(),
    ]);
    categories = serializeData(cats);
    wallets = serializeData(rawWallets);
  } catch (err) {
    console.error("Failed to load categories/wallets for new transaction:", err);
  }

  return (
    <NewTransactionForm
      categories={categories}
      wallets={wallets}
    />
  );
}
