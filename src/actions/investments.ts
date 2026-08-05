"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  await prisma.investment.create({ data: { ...parsed.data, userId } });
  revalidatePath("/investments");
  return { success: true };
}

export async function updateCurrentPrice(id: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = UpdatePriceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.investment.update({
    where: { id, userId },
    data: { currentPrice: parsed.data.currentPrice },
  });

  revalidatePath("/investments");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addInvestLog(investmentId: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = InvestLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const investment = await prisma.investment.findUnique({
    where: { id: investmentId, userId },
  });
  if (!investment) return { error: "Không tìm thấy khoản đầu tư" };

  await prisma.investLog.create({
    data: { ...parsed.data, investmentId },
  });

  revalidatePath("/investments");
  return { success: true };
}

export async function deleteInvestment(id: string) {
  const userId = await getUserId();
  await prisma.investment.delete({ where: { id, userId } });
  revalidatePath("/investments");
  return { success: true };
}
