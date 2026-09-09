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
    targetPrice: parsed.data.targetPrice ? String(parsed.data.targetPrice) : null,
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
  const rawData = Object.fromEntries(formData);
  const parsed = InvestLogSchema.safeParse(rawData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const investment = await db.orm.public.Investment
    .where({ id: investmentId, userId })
    .first();
  if (!investment) return { error: "Không tìm thấy khoản đầu tư" };

  const currentQty = Number(investment.quantity);
  const tradeQty = parsed.data.quantity;
  let newQty = currentQty;
  let walletName: string | null = null;
  const totalAmount = tradeQty * parsed.data.price;

  if (parsed.data.action === "SELL") {
    if (tradeQty > currentQty) {
      return { error: `Số lượng bán (${tradeQty}) vượt quá số lượng đang có (${currentQty})` };
    }
    newQty = Math.max(0, currentQty - tradeQty);

    // Cập nhật số lượng còn lại của khoản đầu tư
    await db.orm.public.Investment
      .where({ id: investmentId, userId })
      .update({ quantity: String(newQty) });

    // Nếu có chọn tài khoản nhận tiền
    if (parsed.data.walletId) {
      const wallet = await db.orm.public.Wallet
        .where({ id: parsed.data.walletId, userId })
        .first();

      if (wallet) {
        walletName = wallet.name;

        // Tìm danh mục phù hợp (ưu tiên INVEST, sau đó INCOME)
        let category = await db.orm.public.Category
          .where({ userId, type: "INVEST" })
          .first();

        if (!category) {
          category = await db.orm.public.Category
            .where({ userId, type: "INCOME" })
            .first();
        }

        if (!category) {
          category = await db.orm.public.Category
            .where({ userId })
            .first();
        }

        if (category) {
          await db.orm.public.Transaction.create({
            amount: String(totalAmount),
            type: "INCOME",
            categoryId: category.id,
            note: `Bán ${tradeQty.toLocaleString("vi-VN")} ${investment.name}${investment.ticker ? ` (${investment.ticker})` : ""}`,
            walletId: wallet.id,
            userId,
            recordedAt: toInstant(parsed.data.recordedAt),
          });
        }
      }
    }
  } else {
    // BUY: Tăng số lượng và tính lại giá vốn trung bình
    const currentBuyPrice = Number(investment.buyPrice);
    const totalCost = currentQty * currentBuyPrice + tradeQty * parsed.data.price;
    newQty = currentQty + tradeQty;
    const newAvgPrice = newQty > 0 ? totalCost / newQty : parsed.data.price;

    await db.orm.public.Investment
      .where({ id: investmentId, userId })
      .update({
        quantity: String(newQty),
        buyPrice: String(newAvgPrice),
      });
  }

  // Ghi nhật ký giao dịch
  await db.orm.public.InvestLog.create({
    action: parsed.data.action,
    quantity: String(parsed.data.quantity),
    price: String(parsed.data.price),
    recordedAt: toInstant(parsed.data.recordedAt),
    investmentId,
  });

  revalidatePath("/investments");
  revalidatePath("/wallets");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return {
    success: true,
    action: parsed.data.action,
    quantity: tradeQty,
    price: parsed.data.price,
    totalAmount,
    walletName,
    newQuantity: newQty,
  };
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

