"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function exportTransactionsCSV() {
  const userId = await getUserId();

  const transactions = await db.orm.public.Transaction
    .where((t) => t.userId.eq(userId))
    .include("category", (cat) => cat)
    .orderBy((t) => t.recordedAt.desc())
    .all();

  const headers = ["ID", "Thời gian", "Loại", "Danh mục", "Số tiền (VND)", "Ghi chú"];
  const rows = transactions.map((t: any) => [
    t.id,
    `"${formatDateTime(t.recordedAt)}"`,
    t.type === "INCOME" ? "Thu nhập" : "Chi tiêu",
    `"${t.category?.name || ""}"`,
    Number(t.amount),
    `"${(t.note || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  return {
    success: true,
    csv: csvContent,
    filename: `wnwallet-giao-dich-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}
