"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toInstant, toDate, serializeData } from "@/lib/utils";
import {
  CashFlowSourceSchema,
  CollectCashFlowSchema,
} from "@/schemas/cash-flow";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function computeNextDate(
  currentDate: Date,
  frequency: "MONTHLY" | "BIWEEKLY" | "WEEKLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME",
  dayOfMonth?: number | null
): { nextDate: Date; isCompleted: boolean } {
  const next = new Date(currentDate);

  if (frequency === "ONE_TIME") {
    return { nextDate: next, isCompleted: true };
  }

  if (frequency === "WEEKLY") {
    next.setDate(next.getDate() + 7);
    return { nextDate: next, isCompleted: false };
  }

  if (frequency === "BIWEEKLY") {
    next.setDate(next.getDate() + 14);
    return { nextDate: next, isCompleted: false };
  }

  if (frequency === "MONTHLY") {
    const targetDay = dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31 ? dayOfMonth : currentDate.getDate();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonth = (currentMonth + 1) % 12;
    const maxDays = new Date(nextYear, nextMonth + 1, 0).getDate();
    const finalDay = Math.min(targetDay, maxDays);
    next.setFullYear(nextYear, nextMonth, finalDay);
    return { nextDate: next, isCompleted: false };
  }

  if (frequency === "QUARTERLY") {
    const targetDay = dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31 ? dayOfMonth : currentDate.getDate();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const totalMonths = currentMonth + 3;
    const nextYear = currentYear + Math.floor(totalMonths / 12);
    const nextMonth = totalMonths % 12;
    const maxDays = new Date(nextYear, nextMonth + 1, 0).getDate();
    const finalDay = Math.min(targetDay, maxDays);
    next.setFullYear(nextYear, nextMonth, finalDay);
    return { nextDate: next, isCompleted: false };
  }

  if (frequency === "YEARLY") {
    const targetDay = currentDate.getDate();
    const currentMonth = currentDate.getMonth();
    const nextYear = currentDate.getFullYear() + 1;
    const maxDays = new Date(nextYear, currentMonth + 1, 0).getDate();
    const finalDay = Math.min(targetDay, maxDays);
    next.setFullYear(nextYear, currentMonth, finalDay);
    return { nextDate: next, isCompleted: false };
  }

  return { nextDate: next, isCompleted: false };
}

export async function getCashFlowSources() {
  const userId = await getUserId();

  const [rawSources, rawWallets, rawCategories, rawInvestments] = await Promise.all([
    db.orm.public.CashFlowSource
      .where((s) => s.userId.eq(userId))
      .orderBy((s) => s.nextExpectedDate.asc())
      .all(),
    db.orm.public.Wallet.where((w) => w.userId.eq(userId)).all(),
    db.orm.public.Category.where((c) => c.userId.eq(userId)).all(),
    db.orm.public.Investment.where((i) => i.userId.eq(userId)).all(),
  ]);

  const sources = serializeData(rawSources);
  const wallets = serializeData(rawWallets);
  const categories = serializeData(rawCategories);
  const investments = serializeData(rawInvestments);

  const walletMap = new Map(wallets.map((w: any) => [w.id, w]));
  const categoryMap = new Map(categories.map((c: any) => [c.id, c]));
  const investMap = new Map(investments.map((i: any) => [i.id, i]));

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalMonthlySalary = 0;
  let totalMonthlyInvestmentYield = 0;
  let totalMonthlyRental = 0;
  let totalMonthlyOther = 0;
  let totalExpectedThisMonth = 0;

  const enrichedSources = sources.map((s: any) => {
    const amt = Number(s.amount);
    const d = toDate(s.nextExpectedDate);

    // Tính quy đổi tương đương theo tháng
    let monthlyEquiv = 0;
    if (s.frequency === "MONTHLY") monthlyEquiv = amt;
    else if (s.frequency === "BIWEEKLY") monthlyEquiv = amt * 2.16;
    else if (s.frequency === "WEEKLY") monthlyEquiv = amt * 4.33;
    else if (s.frequency === "QUARTERLY") monthlyEquiv = amt / 3;
    else if (s.frequency === "YEARLY") monthlyEquiv = amt / 12;
    else monthlyEquiv = amt;

    if (s.isActive) {
      if (s.type === "SALARY") totalMonthlySalary += monthlyEquiv;
      else if (s.type === "INVESTMENT_DIVIDEND") totalMonthlyInvestmentYield += monthlyEquiv;
      else if (s.type === "RENTAL") totalMonthlyRental += monthlyEquiv;
      else totalMonthlyOther += monthlyEquiv;

      // Khoản dự kiến về trong tháng này
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        totalExpectedThisMonth += amt;
      }
    }

    return {
      ...s,
      amount: amt,
      nextExpectedDate: d.toISOString(),
      wallet: s.walletId ? walletMap.get(s.walletId) ?? null : null,
      category: s.categoryId ? categoryMap.get(s.categoryId) ?? null : null,
      investment: s.investmentId ? investMap.get(s.investmentId) ?? null : null,
    };
  });

  const totalMonthlyExpectedInflows =
    totalMonthlySalary + totalMonthlyInvestmentYield + totalMonthlyRental + totalMonthlyOther;

  // Lọc các dòng tiền sắp về trong 30 ngày tới (từ hôm nay, không lấy quá khứ xa)
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // Cho phép hiển thị khoản quá hạn tối đa 7 ngày trước hôm nay
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const upcomingInflows = enrichedSources
    .filter((s: any) => {
      if (!s.isActive) return false;
      const d = toDate(s.nextExpectedDate);
      return d >= sevenDaysAgo && d <= thirtyDaysAhead;
    })
    .sort((a: any, b: any) => toDate(a.nextExpectedDate).getTime() - toDate(b.nextExpectedDate).getTime());

  return {
    sources: enrichedSources,
    upcomingInflows,
    summary: {
      totalMonthlySalary: Math.round(totalMonthlySalary),
      totalMonthlyInvestmentYield: Math.round(totalMonthlyInvestmentYield),
      totalMonthlyRental: Math.round(totalMonthlyRental),
      totalMonthlyOther: Math.round(totalMonthlyOther),
      totalMonthlyExpectedInflows: Math.round(totalMonthlyExpectedInflows),
      totalExpectedThisMonth: Math.round(totalExpectedThisMonth),
      activeCount: enrichedSources.filter((s: any) => s.isActive).length,
      totalCount: enrichedSources.length,
    },
    wallets,
    categories,
    investments,
  };
}

export async function createCashFlowSource(formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = CashFlowSourceSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.orm.public.CashFlowSource.create({
    name: parsed.data.name,
    amount: String(parsed.data.amount),
    type: parsed.data.type,
    frequency: parsed.data.frequency,
    dayOfMonth: parsed.data.dayOfMonth ?? null,
    nextExpectedDate: toInstant(parsed.data.nextExpectedDate),
    isActive: parsed.data.isActive ?? true,
    note: parsed.data.note ?? null,
    walletId: parsed.data.walletId ?? null,
    categoryId: parsed.data.categoryId ?? null,
    investmentId: parsed.data.investmentId ?? null,
    userId,
  });

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateCashFlowSource(id: string, formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = CashFlowSourceSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const existing = await db.orm.public.CashFlowSource.where({ id, userId }).first();
  if (!existing) return { error: "Không tìm thấy nguồn dòng tiền" };

  await db.orm.public.CashFlowSource.where({ id, userId }).update({
    name: parsed.data.name,
    amount: String(parsed.data.amount),
    type: parsed.data.type,
    frequency: parsed.data.frequency,
    dayOfMonth: parsed.data.dayOfMonth ?? null,
    nextExpectedDate: toInstant(parsed.data.nextExpectedDate),
    isActive: parsed.data.isActive ?? true,
    note: parsed.data.note ?? null,
    walletId: parsed.data.walletId ?? null,
    categoryId: parsed.data.categoryId ?? null,
    investmentId: parsed.data.investmentId ?? null,
  });

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleCashFlowSource(id: string) {
  const userId = await getUserId();
  const existing = await db.orm.public.CashFlowSource.where({ id, userId }).first();
  if (!existing) return { error: "Không tìm thấy nguồn dòng tiền" };

  const newStatus = !existing.isActive;
  await db.orm.public.CashFlowSource.where({ id, userId }).update({
    isActive: newStatus,
  });

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { success: true, isActive: newStatus };
}

export async function deleteCashFlowSource(id: string) {
  const userId = await getUserId();
  await db.orm.public.CashFlowSource.where({ id, userId }).delete();

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function collectCashFlow(formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = CollectCashFlowSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const source = await db.orm.public.CashFlowSource.where({ id: parsed.data.sourceId, userId }).first();
  if (!source) return { error: "Không tìm thấy nguồn dòng tiền" };

  const wallet = await db.orm.public.Wallet.where({ id: parsed.data.walletId, userId }).first();
  if (!wallet) return { error: "Không tìm thấy ví nhận tiền" };

  const actualAmount = parsed.data.actualAmount;
  const receivedDate = parsed.data.receivedDate;

  // Tìm danh mục thu nhập tương ứng
  let categoryId = source.categoryId;
  if (!categoryId) {
    const cat = await db.orm.public.Category
      .where({ userId, type: "INCOME" })
      .first();
    if (cat) categoryId = cat.id;
  }

  // Tính ngày nhận tiếp theo
  const currentExpected = toDate(source.nextExpectedDate);
  const { nextDate, isCompleted } = computeNextDate(
    currentExpected,
    source.frequency as any,
    source.dayOfMonth
  );

  const newBalance = Number(wallet.balance ?? 0) + actualAmount;

  await db.transaction(async (tx: any) => {
    // 1. Cộng số dư ví
    await tx.orm.public.Wallet.where({ id: wallet.id, userId }).update({
      balance: String(newBalance),
    });

    // 2. Tạo Transaction INCOME
    if (categoryId) {
      await tx.orm.public.Transaction.create({
        amount: String(actualAmount),
        type: "INCOME",
        note: parsed.data.note?.trim() || `Thu từ dòng tiền: ${source.name}`,
        recordedAt: toInstant(receivedDate),
        walletId: wallet.id,
        categoryId,
        userId,
      });
    }

    // 3. Cập nhật ngày dự kiến kế tiếp cho CashFlowSource
    if (isCompleted) {
      // ONE_TIME: chỉ deactivate, không cần đổi nextExpectedDate
      await tx.orm.public.CashFlowSource.where({ id: source.id, userId }).update({
        isActive: false,
      });
    } else {
      await tx.orm.public.CashFlowSource.where({ id: source.id, userId }).update({
        nextExpectedDate: toInstant(nextDate),
        isActive: source.isActive,
      });
    }
  });

  revalidatePath("/income");
  revalidatePath("/wallets");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/reports");

  return {
    success: true,
    sourceName: source.name,
    actualAmount,
    walletName: wallet.name,
    nextExpectedDate: nextDate.toISOString(),
    isCompleted,
  };
}
