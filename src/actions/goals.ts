"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GoalSchema, GoalContributionSchema } from "@/schemas/goal";
import { toInstant } from "@/lib/utils";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createGoal(formData: FormData) {
  const userId = await getUserId();
  const parsed = GoalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.orm.public.Goal.create({
    ...parsed.data,
    targetAmount: String(parsed.data.targetAmount),
    deadline: parsed.data.deadline ? toInstant(parsed.data.deadline) : null,
    userId,
  });
  revalidatePath("/goals");
  return { success: true };
}

export async function contributeToGoal(goalId: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = GoalContributionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const goal = await db.orm.public.Goal.where({ id: goalId, userId }).first();
  if (!goal) return { error: "Không tìm thấy mục tiêu" };

  // Tìm category savings an toàn (không dùng non-null assertion gây crash)
  let savingsCategory = await db.orm.public.Category
    .where({ userId, type: "SAVINGS" })
    .first();

  if (!savingsCategory) {
    savingsCategory = await db.orm.public.Category
      .where({ userId, type: "EXPENSE" })
      .first();
  }

  if (!savingsCategory) {
    savingsCategory = await db.orm.public.Category.create({
      name: "Tiết kiệm & Mục tiêu",
      type: "SAVINGS",
      icon: "🎯",
      color: "#10b981",
      isDefault: true,
      userId,
    });
  }

  // Xác định ví trích tiền (ưu tiên walletId truyền lên, nếu không có thì lấy ví mặc định của user)
  const requestedWalletId = formData.get("walletId")?.toString() || null;
  let resolvedWalletId: string | null = null;

  if (requestedWalletId) {
    const w = await db.orm.public.Wallet.where({ id: requestedWalletId, userId }).first();
    if (w) resolvedWalletId = w.id;
  } else {
    const defaultWallet = await db.orm.public.Wallet.where({ userId, isDefault: true }).first();
    if (defaultWallet) {
      resolvedWalletId = defaultWallet.id;
    } else {
      const firstWallet = await db.orm.public.Wallet.where({ userId }).first();
      if (firstWallet) resolvedWalletId = firstWallet.id;
    }
  }

  await db.transaction(async (tx: any) => {
    await tx.orm.public.Transaction.create({
      amount: String(parsed.data.amount),
      type: "EXPENSE",
      categoryId: savingsCategory.id,
      note: parsed.data.note ?? `Nạp vào "${goal.name}"`,
      recordedAt: toInstant(parsed.data.recordedAt),
      goalId,
      walletId: resolvedWalletId,
      userId,
    });

    await tx.orm.public.Goal
      .where({ id: goalId, userId })
      .update({ savedAmount: String(Number(goal.savedAmount) + Number(parsed.data.amount)) });
  });

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/wallets");
  revalidatePath("/transactions");
  revalidatePath("/income");
  return { success: true };
}

export async function deleteGoal(id: string) {
  const userId = await getUserId();
  await db.orm.public.Goal.where({ id, userId }).delete();
  revalidatePath("/goals");
  return { success: true };
}
