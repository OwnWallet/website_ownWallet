import { formatCurrency, formatDate, toInstant } from "@/lib/utils";
import { extractSyncedTxIds } from "@/lib/debt-sync";

/**
 * Các thao tác Sổ nợ dùng chung cho Server Actions (chạy bên trong db.transaction).
 *
 * Nguyên tắc:
 * - Liên kết Giao dịch ↔ Khoản nợ được lưu duy nhất ở DebtLog.txId (KHÔNG nối tag vào Debt.note nữa).
 * - Mọi lịch sử (khởi tạo / gộp thêm / thanh toán) được ghi thành DebtLog với recordedAt = ngày giao dịch thực tế.
 * - Gộp nợ là tùy chọn: chỉ gộp khi người dùng chỉ định targetDebtId.
 */

type DebtStatus = "PAID" | "PARTIAL" | "PENDING";

export function computeDebtStatus(amount: number, paid: number): DebtStatus {
  if (amount > 0 && paid >= amount) return "PAID";
  return paid > 0 ? "PARTIAL" : "PENDING";
}

/**
 * Tập hợp txId đã được đưa vào sổ nợ của user.
 * Nguồn chính: DebtLog.txId. Backward-compat: tag [tx_id:...] còn sót trong Debt.note cũ.
 */
export async function getSyncedTxIds(t: any, userId: string): Promise<Set<string>> {
  const debts = await t.orm.public.Debt.where((d: any) => d.userId.eq(userId)).all();
  const set = new Set<string>();
  if (debts.length === 0) return set;

  for (const d of debts) {
    extractSyncedTxIds(d.note).forEach((id) => set.add(id));
  }

  const debtIds = debts.map((d: any) => d.id);
  const logs = await t.orm.public.DebtLog.where((l: any) => l.debtId.in(debtIds)).all();
  for (const l of logs) {
    if (l.txId) set.add(l.txId);
  }
  return set;
}

export interface ApplyDebtSyncInput {
  userId: string;
  txId: string;
  amount: number;
  recordedAt: Date;
  direction: "OWE" | "OWED";
  isRepayment: boolean;
  person: string;
  /** NEW (mặc định): tạo khoản nợ mới. MERGE: gộp vào targetDebtId. */
  mode?: "NEW" | "MERGE";
  /** Khoản nợ đích khi gộp (MERGE) hoặc khi ghi nhận thanh toán (repayment). */
  targetDebtId?: string | null;
  /** Ghi chú thêm cho khoản nợ mới tạo */
  debtNote?: string | null;
}

export interface ApplyDebtSyncResult {
  debtId: string;
  action: "CREATE" | "MERGE" | "PAYMENT" | "CREATE_PAID";
}

async function findTargetDebt(t: any, userId: string, id: string | null | undefined, direction: string) {
  if (!id) return null;
  const debt = await t.orm.public.Debt.where({ id, userId }).first();
  if (!debt || debt.direction !== direction) return null;
  return debt;
}

/**
 * Ghi một giao dịch vào Sổ nợ.
 * - Khoản vay / cho vay: tạo khoản nợ mới, hoặc gộp vào targetDebtId nếu mode = MERGE.
 * - Khoản trả nợ / thu nợ: ghi PAYMENT vào targetDebtId (nếu có) hoặc khoản chưa tất toán
 *   cũ nhất của cùng người & cùng chiều; nếu không có thì tạo khoản đã tất toán.
 */
export async function applyDebtSync(t: any, input: ApplyDebtSyncInput): Promise<ApplyDebtSyncResult> {
  const { userId, txId, amount, recordedAt, direction, isRepayment, person } = input;
  const when = toInstant(recordedAt);
  const dateStr = formatDate(recordedAt);

  if (isRepayment) {
    let target = await findTargetDebt(t, userId, input.targetDebtId, direction);
    if (target && target.status === "PAID") target = null;

    if (!target && input.mode !== "NEW") {
      const openDebts = await t.orm.public.Debt
        .where((d: any) => d.userId.eq(userId))
        .where((d: any) => d.status.neq("PAID"))
        .orderBy((d: any) => d.createdAt.asc())
        .all();
      target =
        openDebts.find(
          (d: any) =>
            d.direction === direction &&
            d.person?.trim().toLowerCase() === person.trim().toLowerCase()
        ) ?? null;
    }

    if (target) {
      const total = Number(target.amount);
      const oldPaid = Number(target.paidAmount || 0);
      const applied = Math.min(amount, Math.max(0, total - oldPaid));
      const newPaid = oldPaid + applied;

      await t.orm.public.Debt.where({ id: target.id, userId }).update({
        paidAmount: String(newPaid),
        status: computeDebtStatus(total, newPaid),
      });
      await t.orm.public.DebtLog.create({
        type: "PAYMENT",
        amount: String(applied),
        note:
          applied < amount
            ? `Thanh toán từ GD ngày ${dateStr}: ${formatCurrency(applied)} (GD ${formatCurrency(amount)}, phần dư không tính vào nợ)`
            : `Thanh toán từ GD ngày ${dateStr}: ${formatCurrency(applied)}`,
        txId,
        debtId: target.id,
        recordedAt: when,
      });
      return { debtId: target.id, action: "PAYMENT" };
    }

    const paidDebt = await t.orm.public.Debt.create({
      person,
      amount: String(amount),
      paidAmount: String(amount),
      direction,
      status: "PAID",
      priority: "NORMAL",
      note: input.debtNote?.trim() || null,
      createdAt: when,
      userId,
    });
    await t.orm.public.DebtLog.create({
      type: "PAYMENT",
      amount: String(amount),
      note: `Ghi nhận trả nợ từ GD ngày ${dateStr}`,
      txId,
      debtId: paidDebt.id,
      recordedAt: when,
    });
    return { debtId: paidDebt.id, action: "CREATE_PAID" };
  }

  if (input.mode === "MERGE") {
    const target = await findTargetDebt(t, userId, input.targetDebtId, direction);
    if (!target) {
      throw new Error("Khoản nợ cần gộp không tồn tại hoặc khác chiều nợ");
    }
    const newAmount = Number(target.amount) + amount;
    const paid = Number(target.paidAmount || 0);
    await t.orm.public.Debt.where({ id: target.id, userId }).update({
      amount: String(newAmount),
      status: computeDebtStatus(newAmount, paid),
    });
    await t.orm.public.DebtLog.create({
      type: "TOPUP",
      amount: String(amount),
      note: `Gộp thêm từ GD ngày ${dateStr}: +${formatCurrency(amount)}`,
      txId,
      debtId: target.id,
      recordedAt: when,
    });
    return { debtId: target.id, action: "MERGE" };
  }

  const newDebt = await t.orm.public.Debt.create({
    person,
    amount: String(amount),
    paidAmount: "0",
    direction,
    status: "PENDING",
    priority: "NORMAL",
    note: input.debtNote?.trim() || null,
    createdAt: when,
    userId,
  });
  await t.orm.public.DebtLog.create({
    type: "INIT",
    amount: String(amount),
    note: `Tạo từ GD ngày ${dateStr}`,
    txId,
    debtId: newDebt.id,
    recordedAt: when,
  });
  return { debtId: newDebt.id, action: "CREATE" };
}

/**
 * Hoàn tác toàn bộ ảnh hưởng của một giao dịch lên Sổ nợ (khi xóa giao dịch).
 */
export async function reverseDebtLogsForTx(t: any, txId: string, userId: string) {
  const linkedLogs = await t.orm.public.DebtLog.where({ txId }).all();
  const escapedId = txId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  for (const log of linkedLogs) {
    const debt = await t.orm.public.Debt.where({ id: log.debtId, userId }).first();
    if (debt) {
      const logAmt = Number(log.amount || 0);
      let updatedAmount = Number(debt.amount);
      let updatedPaid = Number(debt.paidAmount || 0);

      if (log.type === "PAYMENT") {
        updatedPaid = Math.max(0, updatedPaid - logAmt);
      } else if (log.type === "TOPUP" || log.type === "INIT") {
        updatedAmount = Math.max(0, updatedAmount - logAmt);
      }

      // Khoản nợ chỉ sinh ra từ giao dịch này → xóa hẳn
      if (
        (log.type === "INIT" && updatedAmount <= 0 && updatedPaid <= 0) ||
        (log.type === "PAYMENT" && Number(debt.amount) === logAmt && updatedPaid <= 0 && debt.status === "PAID" && (await isOnlyLog(t, debt.id, log.id)))
      ) {
        await t.orm.public.DebtLog.where({ debtId: debt.id }).delete();
        await t.orm.public.Debt.where({ id: debt.id, userId }).delete();
        continue;
      }

      // Dọn tag cũ (dữ liệu trước khi chuyển sang DebtLog)
      const updatedNote = debt.note
        ? debt.note.replace(new RegExp(`\\[tx_id:\\s*${escapedId}\\]`, "g"), "").trim()
        : debt.note;

      await t.orm.public.Debt.where({ id: debt.id, userId }).update({
        amount: String(updatedAmount),
        paidAmount: String(updatedPaid),
        status: computeDebtStatus(updatedAmount, updatedPaid),
        note: updatedNote || null,
      });
    }
    await t.orm.public.DebtLog.where({ id: log.id }).delete();
  }
}

async function isOnlyLog(t: any, debtId: string, logId: string): Promise<boolean> {
  const logs = await t.orm.public.DebtLog.where({ debtId }).all();
  return logs.every((l: any) => l.id === logId);
}

/**
 * Khi sửa giao dịch đã vào sổ nợ: cập nhật số tiền & ngày trực tiếp trên các DebtLog liên kết
 * (giữ nguyên khoản nợ đích). Trả về false nếu giao dịch không còn liên kết nào.
 */
export async function updateDebtLogsForTxEdit(
  t: any,
  txId: string,
  userId: string,
  newAmount: number,
  newRecordedAt: Date
): Promise<boolean> {
  const logs = await t.orm.public.DebtLog.where({ txId }).all();
  if (logs.length === 0) return false;
  const when = toInstant(newRecordedAt);

  for (const log of logs) {
    const debt = await t.orm.public.Debt.where({ id: log.debtId, userId }).first();
    if (!debt) continue;

    const oldLogAmt = Number(log.amount || 0);
    let amount = Number(debt.amount);
    let paid = Number(debt.paidAmount || 0);
    let appliedLogAmt = newAmount;

    if (log.type === "PAYMENT") {
      const basePaid = Math.max(0, paid - oldLogAmt);
      // Khoản "đã tất toán" tạo từ chính giao dịch này → số tiền gốc đi theo giao dịch
      if (debt.status === "PAID" && amount === oldLogAmt && basePaid === 0 && (await isOnlyLog(t, debt.id, log.id))) {
        amount = newAmount;
      }
      appliedLogAmt = Math.min(newAmount, Math.max(0, amount - basePaid));
      paid = basePaid + appliedLogAmt;
    } else if (log.type === "INIT" || log.type === "TOPUP") {
      amount = Math.max(0, amount - oldLogAmt + newAmount);
    }

    await t.orm.public.Debt.where({ id: debt.id, userId }).update({
      amount: String(amount),
      paidAmount: String(paid),
      status: computeDebtStatus(amount, paid),
      ...(log.type === "INIT" ? { createdAt: when } : {}),
    });
    await t.orm.public.DebtLog.where({ id: log.id }).update({
      amount: String(appliedLogAmt),
      recordedAt: when,
    });
  }
  return true;
}
