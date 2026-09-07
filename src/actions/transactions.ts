"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TransactionSchema } from "@/schemas/transaction";
import { toInstant } from "@/lib/utils";

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
  const note = data.note || data.description || null;

  // Xác thực quyền sở hữu danh mục
  const category = await db.orm.public.Category.where({ id: data.categoryId, userId }).first();
  if (!category) {
    return { error: { categoryId: ["Danh mục không tồn tại hoặc không thuộc quyền sở hữu"] } };
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
    await tx.orm.public.Transaction.create({
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
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  revalidatePath("/reports");
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
  const note = data.note || data.description || null;

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

  await db.orm.public.Transaction
    .where({ id, userId })
    .update({
      amount: String(data.amount),
      type: data.type,
      categoryId: data.categoryId,
      note,
      evidenceUrl: data.evidenceUrl || null,
      recordedAt: toInstant(data.recordedAt),
      goalId: data.goalId || null,
      walletId: data.walletId || null,
    });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  revalidatePath("/reports");
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
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/reports");
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
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  revalidatePath("/reports");
  return { success: true, count };
}

