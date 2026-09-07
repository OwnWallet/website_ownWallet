"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/**
 * Phòng chống CSV / Formula Injection (DDE injection trong Excel/Sheets):
 * Nếu ô bắt đầu bằng =, +, -, @, \t, \r thì chèn thêm dấu nháy đơn ' để ngăn Excel coi đó là công thức tính toán.
 */
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
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
    escapeCsvCell(t.id),
    escapeCsvCell(formatDateTime(t.recordedAt)),
    escapeCsvCell(t.type === "INCOME" ? "Thu nhập" : "Chi tiêu"),
    escapeCsvCell(t.category?.name || ""),
    Number(t.amount),
    escapeCsvCell(t.note || ""),
  ]);

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  return {
    success: true,
    csv: csvContent,
    filename: `ownwallet-giao-dich-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}
