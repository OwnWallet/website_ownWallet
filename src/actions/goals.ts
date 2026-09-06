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

  // Tìm category savings mặc định
  const savingsCategory = await db.orm.public.Category
    .where({ userId, type: "SAVINGS", isDefault: true })
    .first();

  await db.transaction(async (tx: any) => {
    await tx.orm.public.Transaction.create({
      amount: String(parsed.data.amount),
      type: "EXPENSE",
      categoryId: savingsCategory!.id,
      note: parsed.data.note ?? `Nạp vào "${goal.name}"`,
      recordedAt: toInstant(parsed.data.recordedAt),
      goalId,
      userId,
    });

    await tx.orm.public.Goal
      .where({ id: goalId, userId })
      .update({ savedAmount: String(Number(goal.savedAmount) + Number(parsed.data.amount)) });
  });

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteGoal(id: string) {
  const userId = await getUserId();
  await db.orm.public.Goal.where({ id, userId }).delete();
  revalidatePath("/goals");
  return { success: true };
}
