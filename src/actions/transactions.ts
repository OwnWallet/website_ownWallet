"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionSchema } from "@/schemas/transaction";

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

  await prisma.$transaction(async (tx) => {
    // Tạo transaction
    await tx.transaction.create({
      data: {
        amount: data.amount,
        type: data.type,
        categoryId: data.categoryId,
        note: data.note,
        recordedAt: data.recordedAt,
        goalId: data.goalId,
        userId,
      },
    });

    // Nếu liên kết Goal → tăng savedAmount
    if (data.goalId) {
      await tx.goal.update({
        where: { id: data.goalId, userId },
        data: { savedAmount: { increment: data.amount } },
      });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = TransactionSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await prisma.transaction.update({
    where: { id, userId },
    data: { ...parsed.data },
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const userId = await getUserId();

  const tx = await prisma.transaction.findUnique({
    where: { id, userId },
  });
  if (!tx) return { error: "Không tìm thấy giao dịch" };

  await prisma.$transaction(async (prismaClient) => {
    await prismaClient.transaction.delete({ where: { id, userId } });

    // Nếu có goalId → giảm savedAmount
    if (tx.goalId) {
      await prismaClient.goal.update({
        where: { id: tx.goalId, userId },
        data: { savedAmount: { decrement: Number(tx.amount) } },
      });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}
