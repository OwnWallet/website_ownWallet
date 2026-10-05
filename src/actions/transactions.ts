"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TransactionSchema } from "@/schemas/transaction";
import { toInstant, formatDate, formatCurrency } from "@/lib/utils";
import { isDebtCategory, getDebtDirection, formatDebtNote, buildSyncTag } from "@/lib/debt-sync";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createTransaction(formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = TransactionSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  let note = data.note || data.description || null;

  // Xác thực quyền sở hữu danh mục
  const category = await db.orm.public.Category.where({ id: data.categoryId, userId }).first();
  if (!category) {
    return { error: { categoryId: ["Danh mục không tồn tại hoặc không thuộc quyền sở hữu"] } };
  }

  // Xử lý người sở hữu khoản nợ nếu là danh mục Vay / Cho vay
  const debtPerson = (data.debtPerson || raw.debtPerson)?.toString()?.trim() || "";
  const syncToDebt =
    data.syncToDebt === true || raw.syncToDebt === "true" || raw.syncToDebt === "on";

  if (isDebtCategory(category) && debtPerson) {
    note = formatDebtNote(debtPerson, note);
  }

  // Xác thực quyền sở hữu ví (nếu có chọn ví)
  if (data.walletId) {
    const wallet = await db.orm.public.Wallet.where({ id: data.walletId, userId }).first();
    if (!wallet) {
      return { error: { walletId: ["Ví không tồn tại hoặc không thuộc quyền sở hữu"] } };
    }
  }

  // Xác thực quyền sở hữu mục tiêu (nếu có chọn mục tiêu)
  if (data.goalId) {
    const goal = await db.orm.public.Goal.where({ id: data.goalId, userId }).first();
    if (!goal) {
      return { error: { goalId: ["Mục tiêu không tồn tại hoặc không thuộc quyền sở hữu"] } };
    }
  }

  await db.transaction(async (tx: any) => {
    const createdTx = await tx.orm.public.Transaction.create({
      amount: String(data.amount),
      type: data.type,
      categoryId: data.categoryId,
      note,
      evidenceUrl: data.evidenceUrl || null,
      recordedAt: toInstant(data.recordedAt),
      goalId: data.goalId || null,
      walletId: data.walletId || null,
      userId,
    });

    // Nếu liên kết Goal → tăng savedAmount
    if (data.goalId) {
      const goal = await tx.orm.public.Goal.where({ id: data.goalId, userId }).first();
      if (goal) {
        await tx.orm.public.Goal
          .where({ id: data.goalId, userId })
          .update({ savedAmount: String(Number(goal.savedAmount) + Number(data.amount)) });
      }
    }

    // Tự động đồng bộ sang Sổ nợ nếu được bật
    if (isDebtCategory(category) && syncToDebt && debtPerson) {
      const direction = getDebtDirection(category, data.type);
      const person = debtPerson;
      const allDebts = await tx.orm.public.Debt
        .where((d: any) => d.userId.eq(userId))
        .all();
      const matchedDebt = allDebts.find(
        (d: any) =>
          d.direction === direction &&
          d.status !== "PAID" &&
          d.person?.trim().toLowerCase() === person.toLowerCase()
      );

      const txDateStr = formatDate(data.recordedAt);
      // BUG-1: Dùng tag chuẩn, ghi vào Debt.note (KHÔNG ghi vào Transaction.note)
      const syncTag = buildSyncTag(createdTx.id);

      if (matchedDebt) {
        const oldAmount = Number(matchedDebt.amount);
        const newAmount = oldAmount + Number(data.amount);
        const paid = Number(matchedDebt.paidAmount || 0);
        const newStatus = paid >= newAmount ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
        const logNote = `Gộp thêm từ GD ngày ${txDateStr}: +${formatCurrency(data.amount)} ${syncTag}`;
        const updatedNote = matchedDebt.note ? `${matchedDebt.note} | ${logNote}` : logNote;

        await tx.orm.public.Debt
          .where({ id: matchedDebt.id, userId })
          .update({
            amount: String(newAmount),
            status: newStatus,
            note: updatedNote,
          });
      } else {
        const initNote = `Tạo từ GD ngày ${txDateStr} ${syncTag}`;
        await tx.orm.public.Debt.create({
          person,
          amount: String(data.amount),
          paidAmount: "0",
          direction,
          status: "PENDING",
          priority: "NORMAL",
          note: initNote,
          userId,
        });
      }
      // Ghi display hint vào Transaction.note để transaction-list hiển thị badge "Đã vào sổ nợ"
      // (Chỉ dùng cho UI display — nguồn sự thật cho duplicate check là Debt.note chứa tag chuẩn)
      const markedNote = note ? `${note} [Đã vào sổ nợ]` : `[Đã vào sổ nợ]`;
      await tx.orm.public.Transaction
        .where({ id: createdTx.id, userId })
        .update({ note: markedNote });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  revalidatePath("/reports");
  revalidatePath("/debts");
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = TransactionSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  let note = data.note || data.description || null;

  // Kiểm tra giao dịch tồn tại và thuộc quyền sở hữu của user
  const existingTx = await db.orm.public.Transaction.where({ id, userId }).first();
  if (!existingTx) {
    return { error: "Không tìm thấy giao dịch" };
  }

  // Xác thực quyền sở hữu danh mục
  const category = await db.orm.public.Category.where({ id: data.categoryId, userId }).first();
  if (!category) {
    return { error: { categoryId: ["Danh mục không tồn tại hoặc không thuộc quyền sở hữu"] } };
  }

  const debtPerson = (data.debtPerson || raw.debtPerson)?.toString()?.trim() || "";
  if (isDebtCategory(category) && debtPerson) {
    note = formatDebtNote(debtPerson, note);
  }

  // Xác thực quyền sở hữu ví (nếu có chọn ví)
  if (data.walletId) {
    const wallet = await db.orm.public.Wallet.where({ id: data.walletId, userId }).first();
    if (!wallet) {
      return { error: { walletId: ["Ví không tồn tại hoặc không thuộc quyền sở hữu"] } };
    }
  }

  // Xác thực quyền sở hữu mục tiêu (nếu có chọn mục tiêu)
  if (data.goalId) {
    const goal = await db.orm.public.Goal.where({ id: data.goalId, userId }).first();
    if (!goal) {
      return { error: { goalId: ["Mục tiêu không tồn tại hoặc không thuộc quyền sở hữu"] } };
    }
  }

  const oldGoalId = existingTx.goalId || null;
  const newGoalId = data.goalId || null;
  const oldAmount = Number(existingTx.amount);
  const newAmount = Number(data.amount);

  await db.transaction(async (t: any) => {
    await t.orm.public.Transaction
      .where({ id, userId })
      .update({
        amount: String(data.amount),
        type: data.type,
        categoryId: data.categoryId,
        note,
        evidenceUrl: data.evidenceUrl || null,
        recordedAt: toInstant(data.recordedAt),
        goalId: newGoalId,
        walletId: data.walletId || null,
      });

    // Đồng bộ Goal.savedAmount khi thay đổi goalId hoặc thay đổi số tiền
    if (oldGoalId && oldGoalId !== newGoalId) {
      const oldGoal = await t.orm.public.Goal.where({ id: oldGoalId, userId }).first();
      if (oldGoal) {
        await t.orm.public.Goal
          .where({ id: oldGoalId, userId })
          .update({ savedAmount: String(Math.max(0, Number(oldGoal.savedAmount) - oldAmount)) });
      }
    }

    if (newGoalId) {
      const newGoal = await t.orm.public.Goal.where({ id: newGoalId, userId }).first();
      if (newGoal) {
        const baseSaved =
          oldGoalId === newGoalId
            ? Math.max(0, Number(newGoal.savedAmount) - oldAmount)
            : Number(newGoal.savedAmount);
        await t.orm.public.Goal
          .where({ id: newGoalId, userId })
          .update({ savedAmount: String(Math.max(0, baseSaved + newAmount)) });
      }
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  revalidatePath("/reports");
  revalidatePath("/debts");
  revalidatePath("/goals");
  revalidatePath("/income");
  return { success: true };
}

async function reverseDebtLogsForTx(t: any, txId: string, userId: string) {
  const linkedLogs = await t.orm.public.DebtLog.where({ txId }).all();
  for (const log of linkedLogs) {
    const debt = await t.orm.public.Debt.where({ id: log.debtId, userId }).first();
    if (debt && log.type === "PAYMENT") {
      const logAmt = Number(log.amount);
      const updatedPaid = Math.max(0, Number(debt.paidAmount) - logAmt);
      const totalAmt = Number(debt.amount);
      const updatedStatus: "PAID" | "PARTIAL" | "PENDING" =
        updatedPaid >= totalAmt ? "PAID" : updatedPaid > 0 ? "PARTIAL" : "PENDING";

      await t.orm.public.Debt
        .where({ id: debt.id, userId })
        .update({
          paidAmount: String(updatedPaid),
          status: updatedStatus,
        });
    }
    await t.orm.public.DebtLog.where({ id: log.id }).delete();
  }
}

export async function deleteTransaction(id: string) {
  const userId = await getUserId();

  const tx = await db.orm.public.Transaction.where({ id, userId }).first();
  if (!tx) return { error: "Không tìm thấy giao dịch" };

  await db.transaction(async (t: any) => {
    await t.orm.public.Transaction.where({ id, userId }).delete();

    // Nếu có goalId → giảm savedAmount
    if (tx.goalId) {
      const goal = await t.orm.public.Goal.where({ id: tx.goalId, userId }).first();
      if (goal) {
        await t.orm.public.Goal
          .where({ id: tx.goalId, userId })
          .update({ savedAmount: String(Math.max(0, Number(goal.savedAmount) - Number(tx.amount))) });
      }
    }

    // Hoàn tác lịch sử trả nợ/thu nợ nếu giao dịch này được tạo từ Sổ nợ
    await reverseDebtLogsForTx(t, id, userId);
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  revalidatePath("/reports");
  revalidatePath("/debts");
  revalidatePath("/goals");
  revalidatePath("/income");
  return { success: true };
}

export async function deleteTransactions(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, count: 0 };
  const userId = await getUserId();

  let count = 0;
  await db.transaction(async (t: any) => {
    for (const id of ids) {
      const tx = await t.orm.public.Transaction.where({ id, userId }).first();
      if (!tx) continue;

      await t.orm.public.Transaction.where({ id, userId }).delete();
      count++;

      if (tx.goalId) {
        const goal = await t.orm.public.Goal.where({ id: tx.goalId, userId }).first();
        if (goal) {
          await t.orm.public.Goal
            .where({ id: tx.goalId, userId })
            .update({ savedAmount: String(Math.max(0, Number(goal.savedAmount) - Number(tx.amount))) });
        }
      }

      await reverseDebtLogsForTx(t, id, userId);
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  revalidatePath("/reports");
  revalidatePath("/debts");
  revalidatePath("/goals");
  revalidatePath("/income");
  return { success: true, count };
}

