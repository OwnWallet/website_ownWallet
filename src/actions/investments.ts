"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toInstant } from "@/lib/utils";
import {
  InvestmentSchema,
  UpdatePriceSchema,
  InvestLogSchema,
} from "@/schemas/investment";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createInvestment(formData: FormData) {
  const userId = await getUserId();
  const parsed = InvestmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.orm.public.Investment.create({
    ...parsed.data,
    quantity: String(parsed.data.quantity),
    buyPrice: String(parsed.data.buyPrice),
    boughtAt: toInstant(parsed.data.boughtAt),
    userId,
  });
  revalidatePath("/investments");
  return { success: true };
}

export async function updateCurrentPrice(id: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = UpdatePriceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.orm.public.Investment
    .where({ id, userId })
    .update({ currentPrice: String(parsed.data.currentPrice) });

  revalidatePath("/investments");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addInvestLog(investmentId: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = InvestLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const investment = await db.orm.public.Investment
    .where({ id: investmentId, userId })
    .first();
  if (!investment) return { error: "Không tìm thấy khoản đầu tư" };

  await db.orm.public.InvestLog.create({
    ...parsed.data,
    quantity: String(parsed.data.quantity),
    price: String(parsed.data.price),
    recordedAt: toInstant(parsed.data.recordedAt),
    investmentId,
  });

  revalidatePath("/investments");
  return { success: true };
}

export async function deleteInvestment(id: string) {
  const userId = await getUserId();
  await db.orm.public.Investment.where({ id, userId }).delete();
  revalidatePath("/investments");
  return { success: true };
}

export async function deleteInvestments(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, count: 0 };
  const userId = await getUserId();

  let count = 0;
  await db.transaction(async (t: any) => {
    for (const id of ids) {
      const inv = await t.orm.public.Investment.where({ id, userId }).first();
      if (!inv) continue;
      await t.orm.public.Investment.where({ id, userId }).delete();
      count++;
    }
  });

  revalidatePath("/investments");
  revalidatePath("/dashboard");
  return { success: true, count };
}

