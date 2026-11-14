import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeData } from "@/lib/utils";
import { NewTransactionForm, type OpenDebtOption } from "./transaction-form";

export default async function NewTransactionPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  let categories: any[] = [];
  let wallets: any[] = [];
  let openDebts: OpenDebtOption[] = [];
  try {
    const [cats, rawWallets, rawDebts] = await Promise.all([
      db.orm.public.Category
        .where((c) => c.userId.eq(session.user.id))
        .orderBy((c) => c.name.asc())
        .all(),
      db.orm.public.Wallet
        .where((w) => w.userId.eq(session.user.id))
        .orderBy((w) => w.createdAt.asc())
        .all(),
      db.orm.public.Debt
        .where((d) => d.userId.eq(session.user.id))
        .where((d) => d.status.neq("PAID"))
        .orderBy((d) => d.createdAt.asc())
        .all(),
    ]);
    categories = serializeData(cats);
    wallets = serializeData(rawWallets);
    openDebts = (serializeData(rawDebts) as any[]).map((d) => ({
      id: d.id,
      person: d.person,
      amount: Number(d.amount),
      paidAmount: Number(d.paidAmount || 0),
      direction: d.direction,
      createdAt: d.createdAt,
    }));
  } catch (err) {
    console.error("Failed to load categories/wallets for new transaction:", err);
  }

  return (
    <NewTransactionForm
      categories={categories}
      wallets={wallets}
      openDebts={openDebts}
    />
  );
}
