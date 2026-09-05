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

  await db.transaction(async (tx: any) => {
    await tx.orm.public.Transaction.create({
      amount: String(data.amount),
      type: data.type,
      categoryId: data.categoryId,
      note,
      recordedAt: toInstant(data.recordedAt),
      goalId: data.goalId || null,
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

  await db.orm.public.Transaction
    .where({ id, userId })
    .update({
      amount: String(data.amount),
      type: data.type,
      categoryId: data.categoryId,
      note,
      recordedAt: toInstant(data.recordedAt),
      goalId: data.goalId || null,
    });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
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
