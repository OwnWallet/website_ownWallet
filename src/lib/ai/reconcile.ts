import { db } from "@/lib/db";
import { toInstant, toDate } from "@/lib/utils";
import type { ParsedTransaction, DuplicateInfo } from "@/schemas/ai-import";

/**
 * Đối chiếu danh sách giao dịch trích xuất từ AI với cơ sở dữ liệu để tìm trùng lặp.
 * Trả về danh sách giao dịch kèm thông tin duplicateInfo.
 */
export async function reconcileTransactionsWithDb(
  transactions: ParsedTransaction[],
  userId: string
): Promise<ParsedTransaction[]> {
  if (!transactions.length) return transactions;

  // Lấy min date và max date của các giao dịch vừa parse (mở rộng ±2 ngày)
  const timestamps = transactions
    .map((t) => new Date(t.recordedAt).getTime())
    .filter((ts) => !isNaN(ts));

  if (!timestamps.length) return transactions;

  const minTime = Math.min(...timestamps) - 2 * 86400 * 1000;
  const maxTime = Math.max(...timestamps) + 2 * 86400 * 1000;

  const minDateInstant = toInstant(new Date(minTime));
  const maxDateInstant = toInstant(new Date(maxTime));

  // Lấy các giao dịch hiện có trong DB của user trong khoảng thời gian này
  let existingTxs: any[] = [];
  try {
    existingTxs = await db.orm.public.Transaction
      .where((t: any) => t.userId.eq(userId))
      .where((t: any) => t.recordedAt.gte(minDateInstant))
      .where((t: any) => t.recordedAt.lte(maxDateInstant))
      .include("category", (cat: any) => cat.select("name"))
      .all();
  } catch (err) {
    console.error("[Reconcile] Lỗi truy vấn giao dịch hiện có để đối chiếu:", err);
    return transactions;
  }

  if (!existingTxs.length) return transactions;

  // Track các ID giao dịch đã được khớp để tránh 1 giao dịch cũ bị gán cho nhiều giao dịch mới
  const matchedExistingIds = new Set<string>();

  return transactions.map((tx) => {
    const txDate = new Date(tx.recordedAt);
    const txDateStr = txDate.toISOString().slice(0, 10);
    const txAmount = Math.round(tx.amount);

    let bestMatch: {
      item: any;
      type: "EXACT" | "POTENTIAL";
      reason: string;
    } | null = null;

    for (const ex of existingTxs) {
      if (matchedExistingIds.has(ex.id)) continue;

      const exAmount = Math.round(Number(ex.amount));
      if (exAmount !== txAmount || ex.type !== tx.type) {
        continue;
      }

      const exDate = toDate(ex.recordedAt);
      const exDateStr = exDate.toISOString().slice(0, 10);
      const diffDays = Math.abs(exDate.getTime() - txDate.getTime()) / (86400 * 1000);

      // Cùng ngày và cùng số tiền, cùng loại
      if (exDateStr === txDateStr) {
        const noteSimilarity =
          tx.note && ex.note
            ? tx.note.toLowerCase().includes(ex.note.toLowerCase()) ||
              ex.note.toLowerCase().includes(tx.note.toLowerCase())
            : true;

        bestMatch = {
          item: ex,
          type: "EXACT",
          reason: noteSimilarity
            ? "Đã có giao dịch trùng khớp hoàn toàn (ngày, số tiền, loại giao dịch)"
            : "Đã có giao dịch cùng ngày và số tiền trong hệ thống",
        };
        break; // Ưu tiên match cùng ngày cao nhất
      }

      // Trùng lặp tiềm ẩn: chênh lệch trong vòng 1.5 ngày
      if (diffDays <= 1.5 && (!bestMatch || bestMatch.type === "POTENTIAL")) {
        bestMatch = {
          item: ex,
          type: "POTENTIAL",
          reason: `Trùng lặp tiềm ẩn (chênh lệch ${diffDays.toFixed(1)} ngày so với GD ngày ${exDateStr})`,
        };
      }
    }

    if (bestMatch) {
      matchedExistingIds.add(bestMatch.item.id);

      const duplicateInfo: DuplicateInfo = {
        isDuplicate: true,
        type: bestMatch.type,
        reason: bestMatch.reason,
        matchedTx: {
          id: bestMatch.item.id,
          amount: Number(bestMatch.item.amount),
          recordedAt: toDate(bestMatch.item.recordedAt).toISOString(),
          note: bestMatch.item.note || null,
          categoryName: bestMatch.item.category?.name,
        },
      };

      return {
        ...tx,
        duplicateInfo,
      };
    }

    return tx;
  });
}
