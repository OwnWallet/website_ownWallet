"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DebtSchema, DebtUpdateSchema, DebtPaymentSchema } from "@/schemas/debt";
import { toInstant, formatDate, formatCurrency, serializeData } from "@/lib/utils";
import {
  isDebtCategory,
  getDebtDirection,
  extractDebtPerson,
  buildSyncTag,
  extractSyncedTxIds,
} from "@/lib/debt-sync";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createDebt(formData: FormData) {
  const userId = await getUserId();
  const parsed = DebtSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const debt = await db.orm.public.Debt.create({
    ...parsed.data,
    amount: String(parsed.data.amount),
    dueDate: parsed.data.dueDate ? toInstant(parsed.data.dueDate) : null,
    userId,
  });

  const initialNote = parsed.data.note?.trim() || (
    parsed.data.direction === "OWE"
      ? `Khởi tạo khoản vay ${formatCurrency(parsed.data.amount)} từ ${parsed.data.person}`
      : `Khởi tạo khoản cho ${parsed.data.person} vay ${formatCurrency(parsed.data.amount)}`
  );

  // Ghi lịch sử: khởi tạo khoản nợ với description rõ ràng
  await db.orm.public.DebtLog.create({
    type: "INIT",
    amount: String(parsed.data.amount),
    note: initialNote,
    debtId: debt.id,
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/income");
  return { success: true };
}

export async function updateDebt(id: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = DebtUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const debt = await db.orm.public.Debt.where({ id, userId }).first();
  if (!debt) return { error: "Không tìm thấy khoản nợ cần cập nhật" };

  const newAmount = parsed.data.amount;
  const newPaid = parsed.data.paidAmount !== undefined ? parsed.data.paidAmount : Number(debt.paidAmount || 0);

  const newStatus: "PAID" | "PARTIAL" | "PENDING" =
    newPaid >= newAmount
      ? "PAID"
      : newPaid > 0
      ? "PARTIAL"
      : "PENDING";

  await db.orm.public.Debt
    .where({ id, userId })
    .update({
      person: parsed.data.person,
      amount: String(newAmount),
      paidAmount: String(newPaid),
      direction: parsed.data.direction,
      priority: parsed.data.priority,
      dueDate: parsed.data.dueDate ? toInstant(parsed.data.dueDate) : null,
      note: parsed.data.note?.trim() || null,
      status: newStatus,
    });

  // Ghi lịch sử chỉnh sửa
  const changes = [];
  if (debt.person !== parsed.data.person) changes.push(`đổi tên "${debt.person}" -> "${parsed.data.person}"`);
  if (Number(debt.amount) !== newAmount) changes.push(`số tiền ${formatCurrency(Number(debt.amount))} -> ${formatCurrency(newAmount)}`);
  if (debt.direction !== parsed.data.direction) changes.push(`chiều nợ -> ${parsed.data.direction === "OWE" ? "Tôi đi vay" : "Cho vay"}`);
  if (debt.priority !== parsed.data.priority) changes.push(`mức ưu tiên -> ${parsed.data.priority}`);

  const logNote = changes.length > 0
    ? `Cập nhật thông tin khoản nợ: ${changes.join(", ")}`
    : "Cập nhật thông tin khoản nợ";

  await db.orm.public.DebtLog.create({
    type: "NOTE",
    amount: String(newAmount),
    note: logNote,
    debtId: id,
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/income");
  return { success: true };
}

export async function recordPayment(id: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = DebtPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const debt = await db.orm.public.Debt.where({ id, userId }).first();
  if (!debt) return { error: "Không tìm thấy khoản nợ" };

  const debtRemain = Math.max(0, Number(debt.amount) - Number(debt.paidAmount));
  // Cap số tiền trả tối đa bằng số còn lại (không thể trả nhiều hơn nợ)
  const cappedPayment = Math.min(parsed.data.paidAmount, debtRemain > 0 ? debtRemain : parsed.data.paidAmount);

  const newPaid = Number(debt.paidAmount) + cappedPayment;
  const newStatus: "PAID" | "PARTIAL" | "PENDING" =
    newPaid >= Number(debt.amount)
      ? "PAID"
      : newPaid > 0
      ? "PARTIAL"
      : "PENDING";

  await db.orm.public.Debt
    .where({ id, userId })
    .update({ paidAmount: String(newPaid), status: newStatus });

  const walletId = formData.get("walletId")?.toString();
  let walletName = "";
  let linkedTxId: string | null = null;

  if (walletId) {
    const wallet = await db.orm.public.Wallet.where({ id: walletId, userId }).first();
    if (wallet) {
      walletName = wallet.name;
      const currentBal = Number(wallet.balance ?? 0);
      const isOwe = debt.direction === "OWE";
      const newBal = isOwe ? currentBal - cappedPayment : currentBal + cappedPayment;

      await db.orm.public.Wallet.where({ id: walletId, userId }).update({
        balance: String(newBal),
      });

      // Tìm danh mục nợ tương ứng
      const catName = isOwe ? "Nợ phải trả" : "Nợ phải thu";
      const category = await db.orm.public.Category.where({ userId, name: catName }).first();

      if (category) {
        const tx = await db.orm.public.Transaction.create({
          amount: String(cappedPayment),
          type: isOwe ? "EXPENSE" : "INCOME",
          note: parsed.data.note?.trim() || `${isOwe ? "Trả nợ cho" : "Thu nợ từ"} ${debt.person}`,
          recordedAt: toInstant(new Date()),
          categoryId: category.id,
          walletId,
          userId,
        });
        linkedTxId = tx.id;
      }
    }
  }

  const paymentNote =
    parsed.data.note?.trim() ||
    (debt.direction === "OWE"
      ? `Thanh toán ${formatCurrency(cappedPayment)} cho ${debt.person}${walletName ? ` qua ví ${walletName}` : ""}`
      : `Thu nợ ${formatCurrency(cappedPayment)} từ ${debt.person}${walletName ? ` vào ví ${walletName}` : ""}`);

  // Ghi lịch sử: ghi nhận thanh toán kèm description đầy đủ và txId nếu có
  await db.orm.public.DebtLog.create({
    type: "PAYMENT",
    amount: String(cappedPayment),
    note: paymentNote,
    txId: linkedTxId,
    debtId: id,
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/wallets");
  revalidatePath("/transactions");

  return {
    success: true,
    person: debt.person,
    direction: debt.direction,
    paidAmount: cappedPayment,
    newPaid,
    totalAmount: Number(debt.amount),
    remainAmount: Math.max(0, Number(debt.amount) - newPaid),
    isCompleted: newPaid >= Number(debt.amount),
  };
}

export async function deleteDebt(id: string) {
  const userId = await getUserId();
  await db.orm.public.Debt.where({ id, userId }).delete();
  revalidatePath("/debts");
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteDebts(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, count: 0 };
  const userId = await getUserId();

  let count = 0;
  await db.transaction(async (t: any) => {
    for (const id of ids) {
      const debt = await t.orm.public.Debt.where({ id, userId }).first();
      if (!debt) continue;
      await t.orm.public.Debt.where({ id, userId }).delete();
      count++;
    }
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return { success: true, count };
}

export async function mergeDebt(debtId: string, additionalAmount: number, additionalNote?: string) {
  const userId = await getUserId();
  if (additionalAmount <= 0) return { error: "Số tiền gộp phải lớn hơn 0" };

  const debt = await db.orm.public.Debt.where({ id: debtId, userId }).first();
  if (!debt) return { error: "Không tìm thấy khoản nợ cũ để gộp" };

  const newAmount = Number(debt.amount) + additionalAmount;
  const newPaid = Number(debt.paidAmount);
  const newStatus: "PAID" | "PARTIAL" | "PENDING" =
    newPaid >= newAmount
      ? "PAID"
      : newPaid > 0
      ? "PARTIAL"
      : "PENDING";

  let updatedNote = debt.note || "";
  if (additionalNote) {
    updatedNote = updatedNote ? `${updatedNote} | Gộp thêm: ${additionalNote}` : `Gộp thêm: ${additionalNote}`;
  }

  await db.orm.public.Debt
    .where({ id: debtId, userId })
    .update({
      amount: String(newAmount),
      status: newStatus,
      note: updatedNote || null,
    });

  // Ghi lịch sử: cộng dồn khoản nợ
  await db.orm.public.DebtLog.create({
    type: "TOPUP",
    amount: String(additionalAmount),
    note: additionalNote || null,
    debtId,
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return {
    success: true,
    newAmount,
    person: debt.person,
    direction: debt.direction,
  };
}

// ─────────────────────────────────────────────────────────────────
// Hàm helper: build bộ txId đã được sync từ danh sách debts
// ─────────────────────────────────────────────────────────────────
function buildSyncedTxIdSet(debts: any[]): Set<string> {
  const set = new Set<string>();
  for (const d of debts) {
    const ids = extractSyncedTxIds(d.note);
    ids.forEach((id) => set.add(id));
  }
  return set;
}

export async function getDebtSyncCandidates() {
  const userId = await getUserId();

  const [rawTxs, rawDebts] = await Promise.all([
    db.orm.public.Transaction
      .where((t) => t.userId.eq(userId))
      .include("category", (cat) => cat)
      .orderBy((t) => t.recordedAt.desc())
      // BUG-5: Tăng limit và thông báo nếu đạt giới hạn
      .limit(2000)
      .all(),
    db.orm.public.Debt
      .where((d) => d.userId.eq(userId))
      .orderBy((d) => d.createdAt.desc())
      .all(),
  ]);

  const transactions = serializeData(rawTxs);
  const debts = serializeData(rawDebts);

  // Lọc các giao dịch thuộc danh mục Vay / Cho vay / Nợ
  const debtTxs = transactions.filter((t: any) => isDebtCategory(t.category));

  // BUG-1: Dùng helper thống nhất để build Set từ tag chuẩn [tx_id:{id}]
  const syncedTxIds = buildSyncedTxIdSet(debts);

  const activeDebts = debts.filter((d: any) => d.status !== "PAID");

  const candidates: Array<{
    txId: string;
    amount: number;
    recordedAt: string;
    type: "INCOME" | "EXPENSE";
    categoryName: string;
    categoryType: string;
    note: string;
    person: string;
    direction: "OWE" | "OWED";
    isDuplicate: boolean;
    actionType: "MERGE" | "CREATE" | "DUPLICATE";
    targetDebtId?: string;
    targetDebtPerson?: string;
    targetDebtCurrentAmount?: number;
    targetDebtNewAmount?: number;
    // BUG-3: Thông báo khi tên người là fallback (không chắc chắn)
    personIsFallback: boolean;
  }> = [];

  let toCreateCount = 0;
  let toMergeCount = 0;
  let duplicateCount = 0;
  let toCreateAmount = 0;
  let toMergeAmount = 0;

  // BUG-2: Map để tích lũy số tiền sẽ gộp vào mỗi debt trong batch preview
  // key = debtId, value = accumulated merge amount từ các Tx trong lần quét này
  const batchMergeAccumulator = new Map<string, number>();

  for (const t of debtTxs) {
    const amount = Number(t.amount);
    const direction = getDebtDirection(t.category, t.type);
    const {
      person: extractedPerson,
      cleanNote,
      hasFallback,
    } = extractDebtPerson(t.note);
    const person = extractedPerson || `Đối tác (${formatDate(t.recordedAt)})`;
    const personIsFallback = hasFallback || !extractedPerson;

    // BUG-1: Dùng syncedTxIds (tag chuẩn) + backward compat với tag cũ trên Transaction.note
    const isDup =
      syncedTxIds.has(t.id) ||
      (t.note && t.note.includes("[Đã vào sổ nợ]"));

    if (isDup) {
      duplicateCount++;
      candidates.push({
        txId: t.id,
        amount,
        recordedAt: new Date(t.recordedAt).toISOString(),
        type: t.type,
        categoryName: t.category?.name || "Nợ",
        categoryType: t.category?.type || "DEBT",
        note: cleanNote || t.note || "",
        person,
        direction,
        isDuplicate: true,
        actionType: "DUPLICATE",
        personIsFallback,
      });
      continue;
    }

    // Đối chiếu với sổ nợ: kiểm tra đã có khoản nợ cùng người và cùng chiều chưa
    const matchedDebt = activeDebts.find(
      (d: any) =>
        d.direction === direction &&
        d.person?.trim().toLowerCase() === person.trim().toLowerCase()
    );

    if (matchedDebt) {
      toMergeCount++;
      toMergeAmount += amount;

      // BUG-2: Tính targetDebtNewAmount dựa trên base amount + tất cả Tx đã gộp trước trong batch
      const alreadyAccumulated = batchMergeAccumulator.get(matchedDebt.id) ?? 0;
      const previewBase = Number(matchedDebt.amount) + alreadyAccumulated;
      const previewNew = previewBase + amount;
      batchMergeAccumulator.set(matchedDebt.id, alreadyAccumulated + amount);

      candidates.push({
        txId: t.id,
        amount,
        recordedAt: new Date(t.recordedAt).toISOString(),
        type: t.type,
        categoryName: t.category?.name || "Nợ",
        categoryType: t.category?.type || "DEBT",
        note: cleanNote || t.note || "",
        person: matchedDebt.person,
        direction,
        isDuplicate: false,
        actionType: "MERGE",
        targetDebtId: matchedDebt.id,
        targetDebtPerson: matchedDebt.person,
        // BUG-2: Hiển thị số tiền tích lũy đúng (base + all prior batch txs)
        targetDebtCurrentAmount: previewBase,
        targetDebtNewAmount: previewNew,
        personIsFallback,
      });
    } else {
      toCreateCount++;
      toCreateAmount += amount;
      candidates.push({
        txId: t.id,
        amount,
        recordedAt: new Date(t.recordedAt).toISOString(),
        type: t.type,
        categoryName: t.category?.name || "Nợ",
        categoryType: t.category?.type || "DEBT",
        note: cleanNote || t.note || "",
        person,
        direction,
        isDuplicate: false,
        actionType: "CREATE",
        personIsFallback,
      });
    }
  }

  // BUG-5: Thông báo nếu kết quả bị giới hạn
  const isLimited = transactions.length >= 2000;

  return {
    candidates,
    summary: {
      totalFound: debtTxs.length,
      toCreateCount,
      toMergeCount,
      duplicateCount,
      toCreateAmount,
      toMergeAmount,
      totalActionableAmount: toCreateAmount + toMergeAmount,
      isLimited,
    },
  };
}

export async function syncTransactionsToDebts(txIds: string[]) {
  if (!txIds || txIds.length === 0) {
    return { error: "Vui lòng chọn ít nhất một giao dịch để đồng bộ" };
  }

  const userId = await getUserId();

  const rawTxs = await db.orm.public.Transaction
    .where((t) => t.userId.eq(userId))
    .include("category", (cat) => cat)
    .orderBy((t) => t.recordedAt.asc())
    .all();

  const transactions = serializeData(rawTxs).filter((t: any) => txIds.includes(t.id));
  if (transactions.length === 0) {
    return { error: "Không tìm thấy giao dịch hợp lệ" };
  }

  const rawDebts = await db.orm.public.Debt
    .where((d) => d.userId.eq(userId))
    .all();
  const currentDebts = serializeData(rawDebts);

  // BUG-1: Dùng helper thống nhất để build Set trùng lặp
  const syncedTxIds = buildSyncedTxIdSet(currentDebts);

  let createdCount = 0;
  let mergedCount = 0;
  let duplicateCount = 0;
  let totalAmount = 0;

  await db.transaction(async (tx: any) => {
    for (const t of transactions) {
      const amount = Number(t.amount);
      const direction = getDebtDirection(t.category, t.type);
      const { person: extractedPerson } = extractDebtPerson(t.note);
      const person = (extractedPerson || `Đối tác (${formatDate(t.recordedAt)})`).trim();

      // BUG-1: Dùng syncedTxIds (tag chuẩn) + backward compat với tag cũ
      if (syncedTxIds.has(t.id) || (t.note && t.note.includes("[Đã vào sổ nợ]"))) {
        duplicateCount++;
        continue;
      }

      const match = currentDebts.find(
        (d: any) =>
          d.direction === direction &&
          d.status !== "PAID" &&
          d.person?.trim().toLowerCase() === person.toLowerCase()
      );

      const txDateStr = formatDate(t.recordedAt);
      // BUG-1: Dùng tag chuẩn buildSyncTag, ghi vào note của Debt (không ghi vào Transaction)
      const syncTag = buildSyncTag(t.id);

      if (match) {
        const oldAmount = Number(match.amount);
        const newAmount = oldAmount + amount;
        const paidAmount = Number(match.paidAmount || 0);
        const newStatus =
          paidAmount >= newAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING";

        const logNote = `Gộp thêm từ GD ngày ${txDateStr}: +${formatCurrency(amount)} ${syncTag}`;
        const updatedNote = match.note ? `${match.note} | ${logNote}` : logNote;

        await tx.orm.public.Debt
          .where({ id: match.id, userId })
          .update({
            amount: String(newAmount),
            status: newStatus,
            note: updatedNote,
          });

        // Ghi lịch sử: cộng dồn từ giao dịch
        await tx.orm.public.DebtLog.create({
          type: "TOPUP",
          amount: String(amount),
          note: `Đồng bộ từ GD ngày ${txDateStr}`,
          txId: t.id,
          debtId: match.id,
        });

        // Cập nhật bản địa để các vòng lặp sau dùng đúng amount mới
        match.amount = newAmount;
        match.status = newStatus;
        match.note = updatedNote;

        // Cập nhật syncedTxIds để vòng lặp sau không re-process
        syncedTxIds.add(t.id);

        mergedCount++;
        totalAmount += amount;
      } else {
        const initNote = `Tạo từ GD ngày ${txDateStr} ${syncTag}`;
        const newDebt = await tx.orm.public.Debt.create({
          person,
          amount: String(amount),
          paidAmount: "0",
          direction,
          status: "PENDING",
          priority: "NORMAL",
          note: initNote,
          userId,
        });

        // Ghi lịch sử: khởi tạo từ giao dịch
        await tx.orm.public.DebtLog.create({
          type: "INIT",
          amount: String(amount),
          note: `Tạo từ GD ngày ${txDateStr}`,
          txId: t.id,
          debtId: newDebt.id,
        });

        currentDebts.push({
          id: newDebt.id,
          person,
          amount,
          paidAmount: 0,
          direction,
          status: "PENDING",
          note: initNote,
          userId,
        });

        // Cập nhật syncedTxIds để vòng lặp sau không re-process
        syncedTxIds.add(t.id);

        createdCount++;
        totalAmount += amount;
      }

      // BUG-1: KHÔNG ghi tag vào Transaction note nữa
      // Liên kết được lưu hoàn toàn trong Debt.note qua syncTag
    }
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return {
    success: true,
    createdCount,
    mergedCount,
    duplicateCount,
    totalAmount,
  };
}

/**
 * BUG-6: Xóa liên kết đồng bộ của một txId khỏi tất cả Debt records.
 * Dùng khi người dùng muốn "hủy đồng bộ" để có thể re-sync lại.
 */
export async function unlinkTxFromDebts(txId: string) {
  const userId = await getUserId();

  const rawDebts = await db.orm.public.Debt
    .where((d) => d.userId.eq(userId))
    .all();
  const debts = serializeData(rawDebts);

  const syncTag = buildSyncTag(txId);
  // Escape txId cho regex (txId thường là UUID nên ký tự đặc biệt ít, nhưng an toàn hơn)
  const escapedId = txId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let unlinkedCount = 0;

  await db.transaction(async (tx: any) => {
    for (const debt of debts) {
      if (!debt.note || !debt.note.includes(syncTag)) continue;

      // Xóa toàn bộ mệnh đề chứa tag này khỏi note của Debt
      const updatedNote = debt.note
        // Xóa "| Gộp thêm từ GD ngày ... [tx_id:xxx]"
        .replace(new RegExp(`\\s*\\|\\s*Gộp thêm từ GD ngày [^|]+\\[tx_id:${escapedId}\\]`, "g"), "")
        // Xóa "Tạo từ GD ngày ... [tx_id:xxx]" (đầu chuỗi)
        .replace(new RegExp(`^Tạo từ GD ngày [^|[]+\\[tx_id:${escapedId}\\]\\s*`, "g"), "")
        // Xóa tag còn sót
        .replace(new RegExp(`\\[tx_id:${escapedId}\\]`, "g"), "")
        // Dọn dẹp dấu pipe thừa
        .replace(/^\s*\|\s*/, "")
        .replace(/\s*\|\s*$/, "")
        .trim();

      await tx.orm.public.Debt
        .where({ id: debt.id, userId })
        .update({ note: updatedNote || null });

      unlinkedCount++;
    }
  });

  revalidatePath("/debts");
  return { success: true, unlinkedCount };
}

// ─────────────────────────────────────────────────────────────────
// Lấy lịch sử (DebtLog) của một khoản nợ, kèm thông tin giao dịch liên kết
// ─────────────────────────────────────────────────────────────────
export async function getDebtLogs(debtId: string) {
  const userId = await getUserId();

  // Verify ownership
  const debt = await db.orm.public.Debt.where({ id: debtId, userId }).first();
  if (!debt) return { error: "Không tìm thấy khoản nợ" };

  const rawLogs = await db.orm.public.DebtLog
    .where((l) => l.debtId.eq(debtId))
    .orderBy((l) => l.recordedAt.asc())
    .all();

  const serializedLogs = serializeData(rawLogs);

  // Collect txIds to enrich
  const txIds = serializedLogs
    .map((l: any) => l.txId)
    .filter(Boolean) as string[];

  const txMap: Record<string, any> = {};
  if (txIds.length > 0) {
    try {
      const rawTxs = await db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .include("category", (cat) => cat)
        .all();
      const allTxs = serializeData(rawTxs);
      for (const tx of allTxs) {
        if (txIds.includes(tx.id)) {
          txMap[tx.id] = {
            id: tx.id,
            amount: Number(tx.amount),
            note: tx.note ?? null,
            type: tx.type,
            recordedAt: tx.recordedAt,
            category: tx.category
              ? { name: tx.category.name, icon: tx.category.icon ?? null, color: tx.category.color }
              : null,
          };
        }
      }
    } catch (err) {
      console.error("[getDebtLogs] Failed to enrich with tx data:", err);
    }
  }

  // Merge tx info into logs
  const enrichedLogs = serializedLogs.map((log: any) => ({
    ...log,
    tx: log.txId ? (txMap[log.txId] ?? null) : null,
  }));

  return {
    success: true,
    debtPerson: debt.person,
    debtDirection: debt.direction,
    debtAmount: Number(debt.amount),
    debtPaidAmount: Number(debt.paidAmount),
    logs: enrichedLogs,
  };
}
