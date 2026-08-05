"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoalSchema, GoalContributionSchema } from "@/schemas/goal";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createGoal(formData: FormData) {
  const userId = await getUserId();
  const parsed = GoalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.goal.create({ data: { ...parsed.data, userId } });
  revalidatePath("/goals");
  return { success: true };
}

export async function contributeToGoal(goalId: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = GoalContributionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const goal = await prisma.goal.findUnique({ where: { id: goalId, userId } });
  if (!goal) return { error: "Không tìm thấy mục tiêu" };

  // Tìm category savings mặc định
  const savingsCategory = await prisma.category.findFirst({
    where: { userId, type: "SAVINGS", isDefault: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        amount: parsed.data.amount,
        type: "EXPENSE",
        categoryId: savingsCategory!.id,
        note: parsed.data.note ?? `Nạp vào "${goal.name}"`,
        recordedAt: parsed.data.recordedAt,
        goalId,
        userId,
      },
    });

    await tx.goal.update({
      where: { id: goalId, userId },
      data: { savedAmount: { increment: parsed.data.amount } },
    });
  });

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteGoal(id: string) {
  const userId = await getUserId();
  await prisma.goal.delete({ where: { id, userId } });
  revalidatePath("/goals");
  return { success: true };
}
