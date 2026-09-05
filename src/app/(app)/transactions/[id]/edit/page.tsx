import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toDate } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";
import { EditTransactionForm } from "./edit-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chỉnh sửa giao dịch — wnWallet" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTransactionPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;

  const [transaction, categories, goals] = await Promise.all([
    db.orm.public.Transaction
      .where({ id, userId })
      .first(),
    db.orm.public.Category
      .where({ userId })
      .orderBy((c) => c.name.asc())
      .all(),
    db.orm.public.Goal
      .where({ userId })
      .orderBy((g) => g.name.asc())
      .all(),
  ]);

  if (!transaction) {
    notFound();
  }

  const plainTx = {
    ...transaction,
    amount: Number(transaction.amount),
    recordedAt: toDate(transaction.recordedAt).toISOString(),
    createdAt: toDate(transaction.createdAt).toISOString(),
    updatedAt: toDate(transaction.updatedAt).toISOString(),
  };

  return (
    <EditTransactionForm
      transaction={plainTx as any}
      categories={categories}
      goals={goals}
    />
  );
}
