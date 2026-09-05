import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeData } from "@/lib/utils";
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

  return (
    <EditTransactionForm
      transaction={serializeData(transaction)}
      categories={serializeData(categories)}
      goals={serializeData(goals)}
    />
  );
}
