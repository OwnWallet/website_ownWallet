"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DebtSchema, DebtPaymentSchema } from "@/schemas/debt";
import { toInstant } from "@/lib/utils";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createDebt(formData: FormData) {
  const userId = await getUserId();
  const parsed = DebtSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.orm.public.Debt.create({
    ...parsed.data,
    amount: String(parsed.data.amount),
    dueDate: parsed.data.dueDate ? toInstant(parsed.data.dueDate) : null,
    userId,
  });
  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function recordPayment(id: string, formData: FormData) {
  const userId = await getUserId();
  const parsed = DebtPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const debt = await db.orm.public.Debt.where({ id, userId }).first();
  if (!debt) return { error: "Không tìm thấy khoản nợ" };

  const newPaid = Number(debt.paidAmount) + parsed.data.paidAmount;
  const newStatus: "PAID" | "PARTIAL" | "PENDING" =
    newPaid >= Number(debt.amount)
      ? "PAID"
      : newPaid > 0
      ? "PARTIAL"
      : "PENDING";

  await db.orm.public.Debt
    .where({ id, userId })
    .update({ paidAmount: String(newPaid), status: newStatus });

  revalidatePath("/debts");
  return { success: true };
}

export async function deleteDebt(id: string) {
  const userId = await getUserId();
  await db.orm.public.Debt.where({ id, userId }).delete();
  revalidatePath("/debts");
  return { success: true };
}

export async function deleteDebts(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, count: 0 };
  const userId = await getUserId();

  let count = 0;
  await db.transaction(async (t: any) => {
    for (const id of ids) {
      const debt = await t.orm.public.Debt.where({ id, userId }).first();
      if (!debt) continue;
      await t.orm.public.Debt.where({ id, userId }).delete();
      count++;
    }
  });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return { success: true, count };
}

export async function mergeDebt(debtId: string, additionalAmount: number, additionalNote?: string) {
  const userId = await getUserId();
  if (additionalAmount <= 0) return { error: "Số tiền gộp phải lớn hơn 0" };

  const debt = await db.orm.public.Debt.where({ id: debtId, userId }).first();
  if (!debt) return { error: "Không tìm thấy khoản nợ cũ để gộp" };

  const newAmount = Number(debt.amount) + additionalAmount;
  const newPaid = Number(debt.paidAmount);
  const newStatus: "PAID" | "PARTIAL" | "PENDING" =
    newPaid >= newAmount
      ? "PAID"
      : newPaid > 0
      ? "PARTIAL"
      : "PENDING";

  let updatedNote = debt.note || "";
  if (additionalNote) {
    updatedNote = updatedNote ? `${updatedNote} | Gộp thêm: ${additionalNote}` : `Gộp thêm: ${additionalNote}`;
  }

  await db.orm.public.Debt
    .where({ id: debtId, userId })
    .update({
      amount: String(newAmount),
      status: newStatus,
      note: updatedNote || null,
    });

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return {
    success: true,
    newAmount,
    person: debt.person,
    direction: debt.direction,
  };
}

