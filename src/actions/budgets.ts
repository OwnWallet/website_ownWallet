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

  // Kiểm tra quyền sở hữu danh mục để chống IDOR
  const category = await db.orm.public.Category.where({ id: categoryId, userId }).first();
  if (!category) {
    return { error: { categoryId: ["Danh mục không tồn tại hoặc không thuộc quyền sở hữu"] } };
  }

  const existing = await db.orm.public.Budget
    .where({ userId, categoryId, month, year })
    .first();

  if (existing) {
    await db.orm.public.Budget
      .where({ id: existing.id, userId })
      .update({ limitAmount: String(limitAmount) });
  } else {
    await db.orm.public.Budget.create({
      userId,
      categoryId,
      limitAmount: String(limitAmount),
      month,
      year,
    });
  }

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
