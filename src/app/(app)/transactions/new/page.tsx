import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NewTransactionForm } from "./transaction-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Thêm giao dịch | wnWallet" };

export default async function NewTransactionPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  let categories: any[] = [];
  try {
    categories = await db.orm.public.Category
      .where((c) => c.userId.eq(session.user.id))
      .orderBy((c) => c.name.asc())
      .all();
  } catch (err) {
    console.error("Failed to load categories for new transaction:", err);
  }

  return <NewTransactionForm categories={categories} />;
}
