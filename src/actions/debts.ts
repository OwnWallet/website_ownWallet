"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DebtSchema, DebtPaymentSchema } from "@/schemas/debt";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createDebt(formData: FormData) {
  const userId = await getUserId();
  const parsed = DebtSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.debt.create({ data: { ...parsed.data, userId } });
  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function recordPayment(id: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = DebtPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const debt = await prisma.debt.findUnique({ where: { id, userId } });
  if (!debt) return { error: "Không tìm thấy khoản nợ" };

  const newPaid = Number(debt.paidAmount) + parsed.data.paidAmount;
  const newStatus =
    newPaid >= Number(debt.amount)
      ? "PAID"
      : newPaid > 0
      ? "PARTIAL"
      : "PENDING";

  await prisma.debt.update({
    where: { id, userId },
    data: { paidAmount: newPaid, status: newStatus },
  });

  revalidatePath("/debts");
  return { success: true };
}

export async function deleteDebt(id: string) {
  const userId = await getUserId();
  await prisma.debt.delete({ where: { id, userId } });
  revalidatePath("/debts");
  return { success: true };
}
