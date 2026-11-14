/**
 * Sửa dữ liệu Sổ nợ cũ (chạy một lần):
 *  1. DebtLog có txId → recordedAt = ngày của giao dịch liên kết (thay vì thời điểm đồng bộ).
 *  2. Tag [tx_id:...] chỉ còn trong Debt.note (chưa có DebtLog) → tạo DebtLog NOTE để giữ liên kết chống trùng.
 *  3. Debt.createdAt = ngày sớm nhất trong lịch sử (INIT ưu tiên) nếu sớm hơn hiện tại.
 *  4. Debt.note: bỏ các mệnh đề hệ thống tự nối ("| Gộp thêm từ GD ngày ... [tx_id:...]") — lịch sử đã nằm trong DebtLog.
 *
 * Mặc định chạy thử (không ghi). Thêm --apply để ghi vào DB:
 *   npx tsx scripts/repair-debts.ts
 *   npx tsx scripts/repair-debts.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { db } from "../src/lib/db";
import { toDate, toInstant, formatDate } from "../src/lib/utils";
import { extractSyncedTxIds, stripDebtSystemNotes } from "../src/lib/debt-sync";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "⚙️  APPLY mode — đang ghi thay đổi vào DB" : "🔍 DRY-RUN — không ghi gì (thêm --apply để ghi)");

  const debts = await db.orm.public.Debt.all();
  const stats = { logDates: 0, restoredLinks: 0, createdAt: 0, notes: 0 };

  // Tập txId đã có DebtLog trên toàn hệ thống
  const allLogs = await db.orm.public.DebtLog.all();
  const linkedTxIds = new Set(allLogs.filter((l: any) => l.txId).map((l: any) => l.txId as string));

  for (const debt of debts as any[]) {
    const label = `${debt.person} (${debt.id})`;
    const logs = (allLogs as any[]).filter((l) => l.debtId === debt.id);

    // 2. Khôi phục liên kết chỉ còn nằm trong note
    for (const txId of extractSyncedTxIds(debt.note)) {
      if (linkedTxIds.has(txId)) continue;
      const tx = await db.orm.public.Transaction.where({ id: txId, userId: debt.userId }).first();
      if (!tx) continue;
      stats.restoredLinks++;
      console.log(`  + [${label}] khôi phục liên kết GD ${txId} (${formatDate(tx.recordedAt)})`);
      if (APPLY) {
        const created = await db.orm.public.DebtLog.create({
          type: "NOTE",
          amount: null,
          note: `Liên kết giao dịch ngày ${formatDate(tx.recordedAt)} (khôi phục từ ghi chú cũ)`,
          txId,
          debtId: debt.id,
          recordedAt: toInstant(tx.recordedAt),
        });
        logs.push(created);
      } else {
        logs.push({ type: "NOTE", txId, recordedAt: tx.recordedAt });
      }
      linkedTxIds.add(txId);
    }

    // 1. Ngày của DebtLog theo giao dịch liên kết
    for (const log of logs) {
      if (!log.txId || !log.id) continue;
      const tx = await db.orm.public.Transaction.where({ id: log.txId }).first();
      if (!tx) continue;
      const txMs = toDate(tx.recordedAt).getTime();
      if (toDate(log.recordedAt).getTime() === txMs) continue;
      stats.logDates++;
      console.log(`  ~ [${label}] log ${log.type}: ${formatDate(log.recordedAt)} → ${formatDate(tx.recordedAt)}`);
      log.recordedAt = tx.recordedAt;
      if (APPLY) {
        await db.orm.public.DebtLog.where({ id: log.id }).update({ recordedAt: toInstant(tx.recordedAt) });
      }
    }

    // 3. createdAt = ngày phát sinh sớm nhất
    const initLogs = logs.filter((l) => l.type === "INIT");
    const source = initLogs.length > 0 ? initLogs : logs.filter((l) => l.type !== "NOTE");
    if (source.length > 0) {
      const earliest = Math.min(...source.map((l) => toDate(l.recordedAt).getTime()));
      if (earliest < toDate(debt.createdAt).getTime()) {
        stats.createdAt++;
        console.log(`  ~ [${label}] createdAt: ${formatDate(debt.createdAt)} → ${formatDate(new Date(earliest))}`);
        if (APPLY) {
          await db.orm.public.Debt.where({ id: debt.id }).update({ createdAt: toInstant(new Date(earliest)) });
        }
      }
    }

    // 4. Dọn note
    const cleaned = stripDebtSystemNotes(debt.note);
    if ((debt.note || "") !== cleaned) {
      stats.notes++;
      console.log(`  ~ [${label}] note: ${String(debt.note || "").length} → ${cleaned.length} ký tự`);
      if (APPLY) {
        await db.orm.public.Debt.where({ id: debt.id }).update({ note: cleaned || null });
      }
    }
  }

  console.log("\nTổng kết:");
  console.log(`  Khoản nợ đã quét:          ${debts.length}`);
  console.log(`  Ngày lịch sử cần sửa:      ${stats.logDates}`);
  console.log(`  Liên kết cần khôi phục:    ${stats.restoredLinks}`);
  console.log(`  Ngày phát sinh cần sửa:    ${stats.createdAt}`);
  console.log(`  Ghi chú cần dọn:           ${stats.notes}`);
  if (!APPLY) console.log("\n→ Chạy lại với --apply để ghi các thay đổi trên.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
