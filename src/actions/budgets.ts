"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BudgetSchema } from "@/schemas/budget";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function upsertBudget(formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = BudgetSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { categoryId, limitAmount, month, year } = parsed.data;

  await prisma.budget.upsert({
    where: { userId_categoryId_month_year: { userId, categoryId, month, year } },
    create: { userId, categoryId, limitAmount, month, year },
    update: { limitAmount },
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBudget(id: string) {
  const userId = await getUserId();
  await prisma.budget.delete({ where: { id, userId } });
  revalidatePath("/budget");
  return { success: true };
}
