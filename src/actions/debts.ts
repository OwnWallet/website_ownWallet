"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DebtSchema, DebtUpdateSchema, DebtPaymentSchema, DebtSplitSchema } from "@/schemas/debt";
import { toInstant, formatDate, formatCurrency, serializeData } from "@/lib/utils";
import {
  isDebtCategory,
  getDebtDirection,
  extractDebtPerson,
  buildSyncTag,
  extractSyncedTxIds,
  DEBT_SKIP_SYNC_TAG,
  analyzeDebtTransaction,
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

  // Guard: khoản nợ đã thanh toán đầy đủ
  if (debt.status === "PAID") {
    return { error: "Khoản nợ này đã được thanh toán đầy đủ, không thể ghi nhận thêm." };
  }

  const debtRemain = Math.max(0, Number(debt.amount) - Number(debt.paidAmount));
  if (debtRemain <= 0) {
    return { error: "Khoản nợ này đã được thanh toán đầy đủ, không thể ghi nhận thêm." };
  }

  // Cap số tiền trả tối đa bằng số còn lại
  const cappedPayment = Math.min(parsed.data.paidAmount, debtRemain);

  const newPaid = Number(debt.paidAmount) + cappedPayment;
  const newStatus: "PAID" | "PARTIAL" | "PENDING" =
    newPaid >= Number(debt.amount)
      ? "PAID"
      : newPaid > 0
      ? "PARTIAL"
      : "PENDING";

  const walletId = formData.get("walletId")?.toString();
  let walletName = "";
  let linkedTxId: string | null = null;

  await db.transaction(async (tx: any) => {
    // 1. Cập nhật trạng thái nợ
    await tx.orm.public.Debt
      .where({ id, userId })
      .update({ paidAmount: String(newPaid), status: newStatus });

    if (walletId) {
      const wallet = await tx.orm.public.Wallet.where({ id: walletId, userId }).first();
      if (wallet) {
        walletName = wallet.name;
        const currentBal = Number(wallet.balance ?? 0);
        const isOwe = debt.direction === "OWE";
        const newBal = isOwe ? currentBal - cappedPayment : currentBal + cappedPayment;

        // Tìm danh mục nợ tương ứng (có fallback sang type DEBT hoặc EXPENSE/INCOME)
        const catName = isOwe ? "Nợ phải trả" : "Nợ phải thu";
        let category = await tx.orm.public.Category.where({ userId, name: catName }).first();
        if (!category) {
          category = await tx.orm.public.Category.where({ userId, type: "DEBT" }).first();
        }
        if (!category) {
          category = await tx.orm.public.Category
            .where({ userId, type: isOwe ? "EXPENSE" : "INCOME" })
            .first();
        }

        if (category) {
          const createdTx = await tx.orm.public.Transaction.create({
            amount: String(cappedPayment),
            type: isOwe ? "EXPENSE" : "INCOME",
            note: parsed.data.note?.trim() || `${isOwe ? "Trả nợ cho" : "Thu nợ từ"} ${debt.person}`,
            recordedAt: toInstant(new Date()),
            categoryId: category.id,
            walletId,
            userId,
          });
          linkedTxId = createdTx.id;
        } else {
          // Chỉ cập nhật trực tiếp balance nếu chưa tạo được bản ghi Transaction
          await tx.orm.public.Wallet.where({ id: walletId, userId }).update({
            balance: String(newBal),
          });
        }
      }
    }

    const paymentNote =
      parsed.data.note?.trim() ||
      (debt.direction === "OWE"
        ? `Thanh toán ${formatCurrency(cappedPayment)} cho ${debt.person}${walletName ? ` qua ví ${walletName}` : ""}`
        : `Thu nợ ${formatCurrency(cappedPayment)} từ ${debt.person}${walletName ? ` vào ví ${walletName}` : ""}`);

    // 2. Ghi lịch sử thanh toán kèm txId nếu có
    await tx.orm.public.DebtLog.create({
      type: "PAYMENT",
      amount: String(cappedPayment),
      note: paymentNote,
      txId: linkedTxId,
      debtId: id,
    });

    // 3. Ghi sync tag vào note của Debt nếu có giao dịch liên kết
    if (linkedTxId) {
      const syncTag = buildSyncTag(linkedTxId);
      const updatedDebtNote = debt.note ? `${debt.note} | ${syncTag}` : syncTag;
      await tx.orm.public.Debt
        .where({ id, userId })
        .update({ note: updatedDebtNote });
    }
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

export async function mergeDebt(
  debtId: string,
  additionalAmount: number,
  additionalNote?: string,
  walletId?: string
) {
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

  let linkedTxId: string | null = null;
  let syncTag = "";

  if (walletId) {
    const wallet = await db.orm.public.Wallet.where({ id: walletId, userId }).first();
    if (wallet) {
      const isOwe = debt.direction === "OWE";
      // OWE (vay thêm): Tiền vào ví -> INCOME
      // OWED (cho vay thêm): Tiền ra khỏi ví -> EXPENSE
      const catName = isOwe ? "Nợ phải trả" : "Nợ phải thu";
      let category = await db.orm.public.Category.where({ userId, name: catName }).first();
      if (!category) {
        category = await db.orm.public.Category.where({ userId, type: "DEBT" }).first();
      }
      if (!category) {
        category = await db.orm.public.Category
          .where({ userId, type: isOwe ? "INCOME" : "EXPENSE" })
          .first();
      }

      if (category) {
        const tx = await db.orm.public.Transaction.create({
          amount: String(additionalAmount),
          type: isOwe ? "INCOME" : "EXPENSE",
          note: additionalNote?.trim() || `${isOwe ? "Vay thêm từ" : "Cho vay thêm"} ${debt.person}`,
          recordedAt: toInstant(new Date()),
          categoryId: category.id,
          walletId,
          userId,
        });
        linkedTxId = tx.id;
        syncTag = ` ${buildSyncTag(tx.id)}`;
      }
    }
  }

  let updatedNote = debt.note || "";
  const mergeNoteText = additionalNote
    ? `Gộp thêm: ${additionalNote}${syncTag}`
    : `Gộp thêm +${formatCurrency(additionalAmount)}${syncTag}`;
  updatedNote = updatedNote ? `${updatedNote} | ${mergeNoteText}` : mergeNoteText;

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
    txId: linkedTxId,
    debtId,
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/wallets");
  revalidatePath("/transactions");
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

  // Lọc các giao dịch thuộc danh mục Vay / Cho vay / Nợ, loại trừ giao dịch đã skip sync
  const debtTxs = transactions.filter(
    (t: any) => isDebtCategory(t.category) && !t.note?.includes(DEBT_SKIP_SYNC_TAG)
  );

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
    isRepayment: boolean;
    actionType: "MERGE" | "CREATE" | "PAYMENT" | "DUPLICATE";
    targetDebtId?: string;
    targetDebtPerson?: string;
    targetDebtCurrentAmount?: number;
    targetDebtNewAmount?: number;
    targetDebtPaidAmount?: number;
    targetDebtNewPaidAmount?: number;
    personIsFallback: boolean;
  }> = [];

  let toCreateCount = 0;
  let toMergeCount = 0;
  let toPaymentCount = 0;
  let duplicateCount = 0;
  let toCreateAmount = 0;
  let toMergeAmount = 0;
  let toPaymentAmount = 0;

  // Map tích lũy số tiền gộp preview
  const batchMergeAccumulator = new Map<string, number>();
  // Map tích lũy số tiền trả preview
  const batchPaymentAccumulator = new Map<string, number>();

  for (const t of debtTxs) {
    const amount = Number(t.amount);
    const analysis = analyzeDebtTransaction(t.category, t.type, t.note);
    const direction = analysis.direction;
    const isRepayment = analysis.isRepayment;
    const person = (analysis.person || `Đối tác (${formatDate(t.recordedAt)})`).trim();
    const personIsFallback = analysis.personIsFallback;
    const cleanNote = analysis.cleanNote;

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
        isRepayment,
        actionType: "DUPLICATE",
        personIsFallback,
      });
      continue;
    }

    // Đối chiếu với sổ nợ: kiểm tra đã có khoản nợ cùng người và cùng chiều chưa
    const matchedDebt = activeDebts.find(
      (d: any) =>
        d.direction === direction &&
        d.person?.trim().toLowerCase() === person.toLowerCase()
    );

    if (isRepayment && matchedDebt) {
      toPaymentCount++;
      toPaymentAmount += amount;

      const alreadyPaidAccumulated = batchPaymentAccumulator.get(matchedDebt.id) ?? 0;
      const previewPaidBase = Number(matchedDebt.paidAmount || 0) + alreadyPaidAccumulated;
      const previewNewPaid = Math.min(Number(matchedDebt.amount), previewPaidBase + amount);
      batchPaymentAccumulator.set(matchedDebt.id, alreadyPaidAccumulated + amount);

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
        isRepayment: true,
        actionType: "PAYMENT",
        targetDebtId: matchedDebt.id,
        targetDebtPerson: matchedDebt.person,
        targetDebtCurrentAmount: Number(matchedDebt.amount),
        targetDebtPaidAmount: previewPaidBase,
        targetDebtNewPaidAmount: previewNewPaid,
        personIsFallback,
      });
    } else if (!isRepayment && matchedDebt) {
      toMergeCount++;
      toMergeAmount += amount;

      // Tính targetDebtNewAmount dựa trên base amount + tất cả Tx đã gộp trước trong batch
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
        isRepayment: false,
        actionType: "MERGE",
        targetDebtId: matchedDebt.id,
        targetDebtPerson: matchedDebt.person,
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
        isRepayment,
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
      toPaymentCount,
      duplicateCount,
      toCreateAmount,
      toMergeAmount,
      toPaymentAmount,
      totalActionableAmount: toCreateAmount + toMergeAmount + toPaymentAmount,
      isLimited,
    },
    activeDebts: activeDebts.map((d: any) => ({
      id: d.id,
      person: d.person,
      amount: Number(d.amount),
      paidAmount: Number(d.paidAmount || 0),
      direction: d.direction as "OWE" | "OWED",
      status: d.status,
      note: d.note,
    })),
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
      // Performance: filter bằng id.in(txIds) thay vì full-table scan toàn bộ Transaction của user
      const rawTxs = await db.orm.public.Transaction
        .where((t) => t.userId.eq(userId))
        .where((t) => t.id.in(txIds))
        .include("category", (cat) => cat)
        .all();
      const allTxs = serializeData(rawTxs);
      for (const tx of allTxs) {
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

export async function dismissDebtSyncCandidate(txId: string) {
  const userId = await getUserId();
  const tx = await db.orm.public.Transaction.where({ id: txId, userId }).first();
  if (!tx) return { error: "Không tìm thấy giao dịch" };

  // Guard: tránh append tag trùng lặp nếu đã bị bỏ qua trước đó
  if (tx.note?.includes(DEBT_SKIP_SYNC_TAG)) {
    return { success: true };
  }

  const updatedNote = tx.note ? `${tx.note} ${DEBT_SKIP_SYNC_TAG}` : DEBT_SKIP_SYNC_TAG;
  await db.orm.public.Transaction
    .where({ id: txId, userId })
    .update({ note: updatedNote });

  revalidatePath("/debts");
  return { success: true };
}

export async function dismissDebtSyncCandidates(txIds: string[]) {
  if (!txIds || txIds.length === 0) return { success: true, count: 0 };
  const userId = await getUserId();
  let count = 0;
  await db.transaction(async (t: any) => {
    for (const id of txIds) {
      const tx = await t.orm.public.Transaction.where({ id, userId }).first();
      if (!tx) continue;
      // Guard: tránh append tag trùng lặp
      if (tx.note?.includes(DEBT_SKIP_SYNC_TAG)) continue;
      const updatedNote = tx.note ? `${tx.note} ${DEBT_SKIP_SYNC_TAG}` : DEBT_SKIP_SYNC_TAG;
      await t.orm.public.Transaction.where({ id, userId }).update({ note: updatedNote });
      count++;
    }
  });
  revalidatePath("/debts");
  return { success: true, count };
}

export interface SyncItemConfig {
  txId: string;
  actionType: "CREATE" | "MERGE" | "PAYMENT";
  person: string;
  direction: "OWE" | "OWED";
  targetDebtId?: string;
}

export async function syncTransactionsToDebtsAdvanced(items: SyncItemConfig[]) {
  if (!items || items.length === 0) {
    return { error: "Vui lòng chọn ít nhất một giao dịch để đồng bộ" };
  }
  const userId = await getUserId();

  const rawTxs = await db.orm.public.Transaction
    .where((t) => t.userId.eq(userId))
    .include("category", (cat) => cat)
    .all();
  const allTxs = serializeData(rawTxs);
  const txMap = new Map<string, any>(allTxs.map((t: any) => [t.id, t]));

  let createdCount = 0;
  let mergedCount = 0;
  let paymentCount = 0;
  let totalAmount = 0;

  await db.transaction(async (tx: any) => {
    for (const item of items) {
      const t = txMap.get(item.txId);
      if (!t) continue;

      const amount = Number(t.amount);
      const syncTag = buildSyncTag(t.id);
      const txDateStr = formatDate(t.recordedAt);
      const person = (item.person || "").trim() || `Đối tác (${txDateStr})`;
      const direction = item.direction;

      if (item.actionType === "CREATE") {
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

        await tx.orm.public.DebtLog.create({
          type: "INIT",
          amount: String(amount),
          note: `Tạo từ GD ngày ${txDateStr}`,
          txId: t.id,
          debtId: newDebt.id,
        });
        createdCount++;
        totalAmount += amount;
      } else if (item.actionType === "MERGE" && item.targetDebtId) {
        const debt = await tx.orm.public.Debt.where({ id: item.targetDebtId, userId }).first();
        if (debt) {
          const oldAmount = Number(debt.amount);
          const newAmount = oldAmount + amount;
          const paidAmount = Number(debt.paidAmount || 0);
          const newStatus = paidAmount >= newAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING";
          const logNote = `Gộp thêm từ GD ngày ${txDateStr}: +${formatCurrency(amount)} ${syncTag}`;
          const updatedNote = debt.note ? `${debt.note} | ${logNote}` : logNote;

          await tx.orm.public.Debt
            .where({ id: debt.id, userId })
            .update({
              amount: String(newAmount),
              status: newStatus,
              note: updatedNote,
            });

          await tx.orm.public.DebtLog.create({
            type: "TOPUP",
            amount: String(amount),
            note: `Đồng bộ gộp từ GD ngày ${txDateStr}`,
            txId: t.id,
            debtId: debt.id,
          });
          mergedCount++;
          totalAmount += amount;
        }
      } else if (item.actionType === "PAYMENT" && item.targetDebtId) {
        const debt = await tx.orm.public.Debt.where({ id: item.targetDebtId, userId }).first();
        if (debt) {
          const debtRemain = Math.max(0, Number(debt.amount) - Number(debt.paidAmount || 0));
          const paymentAmt = Math.min(amount, debtRemain > 0 ? debtRemain : amount);
          const newPaid = Number(debt.paidAmount || 0) + paymentAmt;
          const newStatus = newPaid >= Number(debt.amount) ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING";
          const logNote = `Thanh toán từ GD ngày ${txDateStr}: +${formatCurrency(paymentAmt)} ${syncTag}`;
          const updatedNote = debt.note ? `${debt.note} | ${logNote}` : logNote;

          await tx.orm.public.Debt
            .where({ id: debt.id, userId })
            .update({
              paidAmount: String(newPaid),
              status: newStatus,
              note: updatedNote,
            });

          await tx.orm.public.DebtLog.create({
            type: "PAYMENT",
            amount: String(paymentAmt),
            note: `Ghi nhận trả nợ từ GD ngày ${txDateStr}`,
            txId: t.id,
            debtId: debt.id,
          });
          paymentCount++;
          totalAmount += paymentAmt;
        }
      }
    }
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return {
    success: true,
    createdCount,
    mergedCount,
    paymentCount,
    totalAmount,
  };
}

export async function splitDebtByLog(debtId: string, logId: string, newPerson?: string) {
  const userId = await getUserId();

  const debt = await db.orm.public.Debt.where({ id: debtId, userId }).first();
  if (!debt) return { error: "Không tìm thấy khoản nợ gốc" };

  // Guard: không cho phép tách khoản nợ đã tất toán
  if (debt.status === "PAID") {
    return { error: "Không thể tách khoản nợ đã được thanh toán đầy đủ." };
  }

  const log = await db.orm.public.DebtLog.where({ id: logId, debtId }).first();
  if (!log) return { error: "Không tìm thấy lịch sử gộp nợ" };
  if (log.type !== "TOPUP") return { error: "Chỉ có thể tách khoản đã được gộp thêm (TOPUP)" };

  const splitAmount = Number(log.amount);
  const oldParentAmount = Number(debt.amount);
  const oldParentPaid = Number(debt.paidAmount || 0);
  const oldParentRemain = Math.max(0, oldParentAmount - oldParentPaid);

  // Bất biến: số tiền tách không được vượt quá số nợ chưa trả để tránh sai lệch toán học
  if (splitAmount > oldParentRemain) {
    return { error: `Số tiền tách (${formatCurrency(splitAmount)}) vượt quá số nợ còn lại chưa trả (${formatCurrency(oldParentRemain)}). Vui lòng trả bớt nợ trước.` };
  }

  if (oldParentAmount - splitAmount <= 0) {
    return { error: "Không thể tách khoản nợ khiến nợ ban đầu về 0 hoặc âm" };
  }

  const newParentAmount = oldParentAmount - splitAmount;
  const newParentPaid = Math.min(oldParentPaid, newParentAmount);
  const newParentStatus: "PAID" | "PARTIAL" | "PENDING" =
    newParentPaid >= newParentAmount ? "PAID" : newParentPaid > 0 ? "PARTIAL" : "PENDING";

  const targetPerson = (newPerson || "").trim() || debt.person;

  let childDebtId = "";
  await db.transaction(async (tx: any) => {
    // 1. Tạo khoản nợ mới từ khoản tách
    const childNote = log.note ? `Tách từ khoản nợ của ${debt.person} (${log.note})` : `Tách từ khoản nợ của ${debt.person}`;
    const childDebt = await tx.orm.public.Debt.create({
      person: targetPerson,
      amount: String(splitAmount),
      paidAmount: "0",
      direction: debt.direction,
      status: "PENDING",
      priority: debt.priority,
      note: childNote,
      userId,
    });
    childDebtId = childDebt.id;

    // 2. Ghi log khởi tạo cho khoản nợ mới
    await tx.orm.public.DebtLog.create({
      type: "INIT",
      amount: String(splitAmount),
      note: `Khởi tạo do tách từ khoản nợ của ${debt.person}${log.note ? `: ${log.note}` : ""}`,
      txId: log.txId || null,
      debtId: childDebt.id,
    });

    // 3. Xóa log TOPUP khỏi khoản nợ gốc
    await tx.orm.public.DebtLog.where({ id: logId }).delete();

    // 4. Ghi log NOTE trên khoản nợ gốc
    await tx.orm.public.DebtLog.create({
      type: "NOTE",
      amount: String(splitAmount),
      note: `Đã tách khoản gộp ${formatCurrency(splitAmount)} sang khoản nợ riêng của ${targetPerson}`,
      debtId: debt.id,
    });

    // 5. Cập nhật khoản nợ gốc
    await tx.orm.public.Debt.where({ id: debtId, userId }).update({
      amount: String(newParentAmount),
      paidAmount: String(newParentPaid),
      status: newParentStatus,
    });
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return { success: true, childDebtId, newParentAmount };
}

export async function splitDebtByAmount(
  debtId: string,
  splitAmount: number,
  newPerson?: string,
  note?: string,
  dueDate?: string
) {
  const parsed = DebtSplitSchema.safeParse({
    splitAmount,
    person: newPerson,
    note,
    dueDate,
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstErr = Object.values(fieldErrors).flat()[0] || "Dữ liệu không hợp lệ";
    return { error: firstErr };
  }

  const userId = await getUserId();
  if (splitAmount <= 0) return { error: "Số tiền tách phải lớn hơn 0" };

  const debt = await db.orm.public.Debt.where({ id: debtId, userId }).first();
  if (!debt) return { error: "Không tìm thấy khoản nợ gốc" };

  // Guard: không cho phép tách khoản nợ đã tất toán
  if (debt.status === "PAID") {
    return { error: "Không thể tách khoản nợ đã được thanh toán đầy đủ." };
  }

  const oldParentAmount = Number(debt.amount);
  const oldParentPaid = Number(debt.paidAmount || 0);
  const oldParentRemain = Math.max(0, oldParentAmount - oldParentPaid);

  if (splitAmount >= oldParentAmount) {
    return { error: `Số tiền tách (${formatCurrency(splitAmount)}) phải nhỏ hơn tổng nợ hiện tại (${formatCurrency(oldParentAmount)})` };
  }

  // Bất biến: số tiền tách không được vượt quá số nợ còn lại chưa trả
  if (splitAmount > oldParentRemain) {
    return { error: `Số tiền tách (${formatCurrency(splitAmount)}) vượt quá số nợ còn lại chưa trả (${formatCurrency(oldParentRemain)}). Vui lòng trả bớt nợ trước.` };
  }

  const newParentAmount = oldParentAmount - splitAmount;
  const newParentPaid = Math.min(oldParentPaid, newParentAmount);
  const newParentStatus: "PAID" | "PARTIAL" | "PENDING" =
    newParentPaid >= newParentAmount ? "PAID" : newParentPaid > 0 ? "PARTIAL" : "PENDING";

  const targetPerson = (newPerson || "").trim() || debt.person;

  let childDebtId = "";
  await db.transaction(async (tx: any) => {
    // 1. Tạo khoản nợ mới
    const childDebt = await tx.orm.public.Debt.create({
      person: targetPerson,
      amount: String(splitAmount),
      paidAmount: "0",
      direction: debt.direction,
      status: "PENDING",
      priority: debt.priority,
      dueDate: dueDate ? toInstant(dueDate) : null,
      note: note?.trim() || `Tách số tiền từ khoản nợ của ${debt.person}`,
      userId,
    });
    childDebtId = childDebt.id;

    // 2. Ghi log khởi tạo cho khoản nợ con
    await tx.orm.public.DebtLog.create({
      type: "INIT",
      amount: String(splitAmount),
      note: note?.trim() || `Tạo do tách từ khoản nợ của ${debt.person}`,
      debtId: childDebt.id,
    });

    // 3. Ghi log NOTE trên khoản nợ gốc
    await tx.orm.public.DebtLog.create({
      type: "NOTE",
      amount: String(splitAmount),
      note: `Đã tách số tiền ${formatCurrency(splitAmount)} sang khoản nợ riêng của ${targetPerson}`,
      debtId: debt.id,
    });

    // 4. Cập nhật khoản nợ gốc
    await tx.orm.public.Debt.where({ id: debtId, userId }).update({
      amount: String(newParentAmount),
      paidAmount: String(newParentPaid),
      status: newParentStatus,
    });
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return { success: true, childDebtId, newParentAmount };
}
