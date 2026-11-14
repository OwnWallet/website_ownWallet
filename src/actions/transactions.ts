"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TransactionSchema } from "@/schemas/transaction";
import { toInstant } from "@/lib/utils";
import { isDebtCategory, formatDebtNote, analyzeDebtTransaction } from "@/lib/debt-sync";
import { applyDebtSync, reverseDebtLogsForTx, updateDebtLogsForTxEdit } from "@/lib/debt-sync-db";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const DEBT_SYNCED_MARK = "[Đã vào sổ nợ]";

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  revalidatePath("/reports");
  revalidatePath("/debts");
  revalidatePath("/goals");
  revalidatePath("/income");
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
  const debtPerson = data.debtPerson?.toString()?.trim() || "";
  const syncToDebt = data.syncToDebt === true;

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

  const willSyncDebt = isDebtCategory(category) && syncToDebt && !!debtPerson;
  const debtMode = data.debtMode === "MERGE" ? "MERGE" : "NEW";

  // Gộp nợ là tùy chọn → nếu chọn gộp thì bắt buộc chọn khoản nợ đích
  if (willSyncDebt && debtMode === "MERGE") {
    if (!data.targetDebtId) {
      return { error: { targetDebtId: ["Vui lòng chọn khoản nợ cần gộp"] } };
    }
    const target = await db.orm.public.Debt.where({ id: data.targetDebtId, userId }).first();
    if (!target) {
      return { error: { targetDebtId: ["Khoản nợ cần gộp không tồn tại"] } };
    }
  }

  try {
    await db.transaction(async (tx: any) => {
      const finalNote = willSyncDebt ? (note ? `${note} ${DEBT_SYNCED_MARK}` : DEBT_SYNCED_MARK) : note;

      const createdTx = await tx.orm.public.Transaction.create({
        amount: String(data.amount),
        type: data.type,
        categoryId: data.categoryId,
        note: finalNote,
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

      // Đồng bộ sang Sổ nợ: lịch sử ghi vào DebtLog với ngày giao dịch thực tế
      if (willSyncDebt) {
        const analysis = analyzeDebtTransaction(category, data.type, note);
        await applyDebtSync(tx, {
          userId,
          txId: createdTx.id,
          amount: Number(data.amount),
          recordedAt: data.recordedAt,
          direction: analysis.direction,
          isRepayment: analysis.isRepayment,
          person: debtPerson,
          mode: debtMode,
          targetDebtId: data.targetDebtId ?? null,
        });
      }
    });
  } catch (err: any) {
    return { error: err?.message || "Không thể lưu giao dịch" };
  }

  revalidateAll();
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

  const debtPerson = data.debtPerson?.toString()?.trim() || "";
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
  const wasMarked = String(existingTx.note || "").includes(DEBT_SYNCED_MARK);

  await db.transaction(async (t: any) => {
    // Đồng bộ Sổ nợ khi sửa giao dịch đã liên kết
    const stillDebtLinked = isDebtCategory(category) && existingTx.type === data.type;
    let keepMark = false;
    if (stillDebtLinked) {
      keepMark = await updateDebtLogsForTxEdit(t, id, userId, newAmount, data.recordedAt);
    } else {
      // Đổi sang danh mục không phải nợ hoặc đổi chiều tiền → gỡ khỏi Sổ nợ
      await reverseDebtLogsForTx(t, id, userId);
    }

    const finalNote =
      keepMark || (wasMarked && stillDebtLinked)
        ? note?.includes(DEBT_SYNCED_MARK)
          ? note
          : note
            ? `${note} ${DEBT_SYNCED_MARK}`
            : DEBT_SYNCED_MARK
        : note?.replace(DEBT_SYNCED_MARK, "").trim() || null;

    await t.orm.public.Transaction
      .where({ id, userId })
      .update({
        amount: String(data.amount),
        type: data.type,
        categoryId: data.categoryId,
        note: finalNote,
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

  revalidateAll();
  return { success: true };
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

    // Hoàn tác lịch sử nợ liên kết với giao dịch này
    await reverseDebtLogsForTx(t, id, userId);
  });

  revalidateAll();
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

  revalidateAll();
  return { success: true, count };
}
