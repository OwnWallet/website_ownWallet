"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

  // Prisma 8 upsert — dựa trên unique constraint [userId, categoryId, month, year]
  await db.orm.public.Budget.upsert({
    create: { userId, categoryId, limitAmount: String(limitAmount), month, year },
    update: { limitAmount: String(limitAmount) },
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBudget(id: string) {
  const userId = await getUserId();
  await db.orm.public.Budget.where({ id, userId }).delete();
  revalidatePath("/budget");
  return { success: true };
}
