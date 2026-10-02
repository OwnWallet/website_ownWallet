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

export async function deleteBudgets(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, count: 0 };
  const userId = await getUserId();

  let count = 0;
  await db.transaction(async (t: any) => {
    for (const id of ids) {
      const b = await t.orm.public.Budget.where({ id, userId }).first();
      if (!b) continue;
      await t.orm.public.Budget.where({ id, userId }).delete();
      count++;
    }
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { success: true, count };
}

/**
 * Chuyển số dư ngân sách tháng trước sang tháng sau.
 * - mode = "rollover": cộng thêm phần chưa tiêu vào hạn mức tháng đích.
 * - mode = "copy": chỉ sao chép y chang limit.
 */
export async function rolloverBudgets(formData: FormData) {
  const userId = await getUserId();
  const fromMonth = Number(formData.get("fromMonth"));
  const fromYear = Number(formData.get("fromYear"));
  const toMonth = Number(formData.get("toMonth"));
  const toYear = Number(formData.get("toYear"));
  const mode = formData.get("mode") === "rollover" ? "rollover" : "copy";

  if (
    !fromMonth || !fromYear || !toMonth || !toYear ||
    fromMonth < 1 || fromMonth > 12 || toMonth < 1 || toMonth > 12 ||
    fromYear < 2000 || toYear < 2000
  ) {
    return { error: "Tháng/năm không hợp lệ" };
  }

  const { toInstant } = await import("@/lib/utils");

  const sourceBudgets = await db.orm.public.Budget
    .where((b) => b.userId.eq(userId))
    .where((b) => b.month.eq(fromMonth))
    .where((b) => b.year.eq(fromYear))
    .all();

  if ((sourceBudgets as any[]).length === 0) {
    return { error: `Không có ngân sách nào trong tháng ${fromMonth}/${fromYear}` };
  }

  const spentMap = new Map<string, number>();
  if (mode === "rollover") {
    const from = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
    const to = new Date(Date.UTC(fromYear, fromMonth, 0, 23, 59, 59, 999));
    const txs = await db.orm.public.Transaction
      .where((t) => t.userId.eq(userId))
      .where((t) => t.type.eq("EXPENSE"))
      .where((t) => t.recordedAt.gte(toInstant(from)))
      .where((t) => t.recordedAt.lte(toInstant(to)))
      .all();
    (txs as any[]).forEach((tx: any) => {
      spentMap.set(tx.categoryId, (spentMap.get(tx.categoryId) ?? 0) + Number(tx.amount));
    });
  }

  let created = 0;
  let updated = 0;

  await db.transaction(async (t: any) => {
    for (const src of sourceBudgets as any[]) {
      const srcLimit = Number(src.limitAmount);
      const spent = spentMap.get(src.categoryId) ?? 0;
      const rolloverAmount = mode === "rollover" ? Math.max(0, srcLimit - spent) : 0;
      const newLimit = srcLimit + rolloverAmount;

      const existing = await t.orm.public.Budget
        .where({ userId, categoryId: src.categoryId, month: toMonth, year: toYear })
        .first();

      if (existing) {
        const mergedLimit = Number(existing.limitAmount) + rolloverAmount;
        await t.orm.public.Budget
          .where({ id: existing.id, userId })
          .update({ limitAmount: String(mode === "rollover" ? mergedLimit : Number(existing.limitAmount)) });
        updated++;
      } else {
        await t.orm.public.Budget.create({
          userId,
          categoryId: src.categoryId,
          limitAmount: String(newLimit),
          month: toMonth,
          year: toYear,
        });
        created++;
      }
    }
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { success: true, created, updated, total: created + updated };
}
