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
  if (id.startsWith("virtual_")) {
    const parts = id.split("_");
    const categoryId = parts[1];
    if (categoryId) {
      await db.orm.public.Budget.where({ userId, categoryId }).delete();
    }
  } else {
    const target = await db.orm.public.Budget.where({ id, userId }).first();
    if (target) {
      // Xóa ngân sách của danh mục này ở kỳ hiện tại và các kỳ trước để không bị tự động kế thừa lại sau khi xóa
      const allForCat = await db.orm.public.Budget
        .where({ userId, categoryId: target.categoryId })
        .all();
      const targetYM = target.year * 12 + target.month;
      for (const item of allForCat) {
        if (item.year * 12 + item.month <= targetYM) {
          await db.orm.public.Budget.where({ id: item.id, userId }).delete();
        }
      }
    }
  }
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBudgets(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, count: 0 };
  const userId = await getUserId();

  let count = 0;
  await db.transaction(async (t: any) => {
    for (const id of ids) {
      if (id.startsWith("virtual_")) {
        const parts = id.split("_");
        const categoryId = parts[1];
        if (categoryId) {
          await t.orm.public.Budget.where({ userId, categoryId }).delete();
          count++;
        }
        continue;
      }
      const b = await t.orm.public.Budget.where({ id, userId }).first();
      if (!b) continue;
      const allForCat = await t.orm.public.Budget
        .where({ userId, categoryId: b.categoryId })
        .all();
      const targetYM = b.year * 12 + b.month;
      for (const item of allForCat) {
        if (item.year * 12 + item.month <= targetYM) {
          await t.orm.public.Budget.where({ id: item.id, userId }).delete();
        }
      }
      count++;
    }
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { success: true, count };
}

export interface EnrichedBudgetItem {
  id: string;
  userId: string;
  categoryId: string;
  month: number;
  year: number;
  baseLimit: number;
  rolloverAmount: number;
  limitAmount: number; // effectiveLimit = baseLimit + rolloverAmount
  spent: number;
  remaining: number;
  percent: number;
  prevMonth: number;
  prevYear: number;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    type: string;
  } | null;
}

/**
 * Tự động kế thừa ngân sách định kỳ sang tháng hiện tại (theo thời gian thực, in-memory)
 * và tự động cộng số dư chưa tiêu (> 0) của tháng trước vào hạn mức tháng sau
 * mà không cần kích hoạt bằng nút thủ công và không tự động ghi rác vào DB khi đọc.
 */
export async function getAutoRolloverBudgets(
  userId: string,
  targetMonth: number | "ALL",
  targetYear: number,
  walletId?: string
): Promise<{
  budgets: EnrichedBudgetItem[];
  totalBaseLimit: number;
  totalRolloverAmount: number;
  totalEffectiveLimit: number;
  totalSpent: number;
}> {
  const { toInstant, getVNDateParts, calcPercent, serializeData } = await import("@/lib/utils");

  const { year: realYear, month: realMonth } = getVNDateParts(new Date());

  // Lấy toàn bộ ngân sách của user trong DB
  const allBudgets = (await db.orm.public.Budget
    .where((b) => b.userId.eq(userId))
    .include("category", (cat) => cat)
    .orderBy((b) => b.year.asc())
    .orderBy((b) => b.month.asc())
    .all()) as any[];

  if (allBudgets.length === 0) {
    return {
      budgets: [],
      totalBaseLimit: 0,
      totalRolloverAmount: 0,
      totalEffectiveLimit: 0,
      totalSpent: 0,
    };
  }

  const checkYear = targetYear;
  const checkMonth = targetMonth === "ALL" ? (targetYear === realYear ? realMonth : 12) : targetMonth;
  const checkYM = checkYear * 12 + checkMonth;
  const realYM = realYear * 12 + realMonth;
  const autoInheritTargetYM = Math.min(checkYM, realYM);

  // Tìm khoảng thời gian từ ngân sách sớm nhất đến kỳ đang xem để tính chi tiêu & kết chuyển lũy kế
  let minYM = Infinity;
  let maxYM = -Infinity;
  for (const b of allBudgets) {
    const ym = b.year * 12 + b.month;
    if (ym < minYM) minYM = ym;
    if (ym > maxYM) maxYM = ym;
  }
  const targetMaxYM = targetMonth === "ALL" ? targetYear * 12 + 12 : targetYear * 12 + targetMonth;
  if (targetMaxYM > maxYM) maxYM = targetMaxYM;
  if (autoInheritTargetYM > maxYM) maxYM = autoInheritTargetYM;

  const minYear = Math.floor((minYM - 1) / 12);
  const minMonth = ((minYM - 1) % 12) + 1;
  const maxYear = Math.floor((maxYM - 1) / 12);
  const maxMonth = ((maxYM - 1) % 12) + 1;

  const VN_OFFSET_MINUTES = 420; // UTC+7
  const rangeFrom = new Date(Date.UTC(minYear, minMonth - 1, 1, 0, 0, 0, 0) - VN_OFFSET_MINUTES * 60_000);
  const rangeTo = new Date(Date.UTC(maxYear, maxMonth, 0, 23, 59, 59, 999) - VN_OFFSET_MINUTES * 60_000);

  let expenseQuery = db.orm.public.Transaction
    .where((t) => t.userId.eq(userId))
    .where((t) => t.type.eq("EXPENSE"))
    .where((t) => t.recordedAt.gte(toInstant(rangeFrom)))
    .where((t) => t.recordedAt.lte(toInstant(rangeTo)));

  if (walletId && walletId !== "ALL") {
    if (walletId === "UNASSIGNED") {
      expenseQuery = expenseQuery.where({ walletId: null });
    } else {
      expenseQuery = expenseQuery.where({ walletId });
    }
  }

  const expenseTxs = (await expenseQuery.all()) as any[];

  // Map chi tiêu theo `${categoryId}_${year}_${month}` theo đúng múi giờ Việt Nam (UTC+7)
  const spentCatMonthMap = new Map<string, number>();

  for (const tx of expenseTxs) {
    const { year: y, month: m } = getVNDateParts(tx.recordedAt);
    const amt = Number(tx.amount);
    const key = `${tx.categoryId}_${y}_${m}`;
    spentCatMonthMap.set(key, (spentCatMonthMap.get(key) ?? 0) + amt);
  }

  // Nhóm các bản ghi DB theo categoryId và xây dựng chuỗi thời gian in-memory (không ghi rác DB)
  const byCategory = new Map<string, any[]>();
  for (const b of allBudgets) {
    const list = byCategory.get(b.categoryId) || [];
    list.push(b);
    byCategory.set(b.categoryId, list);
  }

  const enrichedAll: EnrichedBudgetItem[] = [];

  for (const [catId, list] of byCategory.entries()) {
    list.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
    const existingYM = new Map<number, any>();
    for (const item of list) {
      existingYM.set(item.year * 12 + item.month, item);
    }

    const firstYM = list[0].year * 12 + list[0].month;
    const lastConfiguredYM = list[list.length - 1].year * 12 + list[list.length - 1].month;
    const endYM = Math.max(lastConfiguredYM, autoInheritTargetYM);
    const catInfo = list[0].category ? serializeData(list[0].category) : null;

    let lastBaseLimit = Number(list[0].limitAmount);
    let prevEffectiveLimit = 0;
    let prevSpent = 0;
    let hasPrev = false;

    for (let ym = firstYM; ym <= endYM; ym++) {
      const y = Math.floor((ym - 1) / 12);
      const m = ((ym - 1) % 12) + 1;
      const dbRecord = existingYM.get(ym);

      if (dbRecord) {
        lastBaseLimit = Number(dbRecord.limitAmount);
      }

      const baseLimit = lastBaseLimit;
      const rolloverAmount = hasPrev ? Math.max(0, prevEffectiveLimit - prevSpent) : 0;
      const effectiveLimit = baseLimit + rolloverAmount;
      const spent = spentCatMonthMap.get(`${catId}_${y}_${m}`) ?? 0;
      const remaining = effectiveLimit - spent;
      const percent = calcPercent(spent, effectiveLimit);

      const prevMonth = m === 1 ? 12 : m - 1;
      const prevYear = m === 1 ? y - 1 : y;

      enrichedAll.push({
        id: dbRecord ? dbRecord.id : `virtual_${catId}_${y}_${m}`,
        userId,
        categoryId: catId,
        month: m,
        year: y,
        baseLimit,
        rolloverAmount,
        limitAmount: effectiveLimit,
        spent,
        remaining,
        percent,
        prevMonth,
        prevYear,
        category: catInfo,
      });

      hasPrev = true;
      prevEffectiveLimit = effectiveLimit;
      prevSpent = spent;
    }
  }

  // Nếu xem theo tháng cụ thể
  if (targetMonth !== "ALL") {
    const filteredBudgets = enrichedAll.filter(
      (b) => b.year === targetYear && b.month === targetMonth
    );

    const totalBaseLimit = filteredBudgets.reduce((s, b) => s + b.baseLimit, 0);
    const totalRolloverAmount = filteredBudgets.reduce((s, b) => s + b.rolloverAmount, 0);
    const totalEffectiveLimit = filteredBudgets.reduce((s, b) => s + b.limitAmount, 0);
    const totalSpent = filteredBudgets.reduce((s, b) => s + b.spent, 0);

    return {
      budgets: serializeData(filteredBudgets),
      totalBaseLimit,
      totalRolloverAmount,
      totalEffectiveLimit,
      totalSpent,
    };
  }

  // Chế độ "Cả năm" (targetMonth === "ALL"):
  // Gộp theo từng danh mục trong năm targetYear, không cộng trùng rollover nội bộ giữa các tháng trong cùng năm
  const yearItems = enrichedAll.filter((b) => b.year === targetYear);
  const byCatYear = new Map<string, EnrichedBudgetItem[]>();
  for (const item of yearItems) {
    const arr = byCatYear.get(item.categoryId) || [];
    arr.push(item);
    byCatYear.set(item.categoryId, arr);
  }

  const aggregatedYearBudgets: EnrichedBudgetItem[] = [];
  for (const [catId, items] of byCatYear.entries()) {
    items.sort((a, b) => a.month - b.month);
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const yearBaseLimit = items.reduce((s, x) => s + x.baseLimit, 0);
    // Chỉ lấy số dư kết chuyển từ cuối năm trước (nếu firstItem là tháng 1)
    const yearRolloverAmount = firstItem.month === 1 ? firstItem.rolloverAmount : 0;
    const yearEffectiveLimit = yearBaseLimit + yearRolloverAmount;
    const yearSpent = items.reduce((s, x) => s + x.spent, 0);
    const remaining = yearEffectiveLimit - yearSpent;
    const percent = calcPercent(yearSpent, yearEffectiveLimit);

    aggregatedYearBudgets.push({
      id: lastItem.id,
      userId,
      categoryId: catId,
      month: lastItem.month,
      year: targetYear,
      baseLimit: yearBaseLimit,
      rolloverAmount: yearRolloverAmount,
      limitAmount: yearEffectiveLimit,
      spent: yearSpent,
      remaining,
      percent,
      prevMonth: 12,
      prevYear: targetYear - 1,
      category: firstItem.category,
    });
  }

  const totalBaseLimit = aggregatedYearBudgets.reduce((s, b) => s + b.baseLimit, 0);
  const totalRolloverAmount = aggregatedYearBudgets.reduce((s, b) => s + b.rolloverAmount, 0);
  const totalEffectiveLimit = aggregatedYearBudgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent = aggregatedYearBudgets.reduce((s, b) => s + b.spent, 0);

  return {
    budgets: serializeData(aggregatedYearBudgets),
    totalBaseLimit,
    totalRolloverAmount,
    totalEffectiveLimit,
    totalSpent,
  };
}

