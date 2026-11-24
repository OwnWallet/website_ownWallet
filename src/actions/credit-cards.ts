"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, serializeData, toDate, toInstant } from "@/lib/utils";
import { fromCents, toCents } from "@/lib/money";
import { TRANSFER_CATEGORY_NAME } from "@/lib/finance";
import { getInstallmentProgress, getWalletKind } from "@/lib/credit-card";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const emptyToUndefined = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);

const InstallmentSchema = z.object({
  walletId: z.string().min(1, "Vui lòng chọn thẻ tín dụng"),
  name: z.string().trim().min(1, "Vui lòng nhập tên khoản trả góp").max(100),
  principal: z.coerce.number().positive("Số tiền trả góp phải lớn hơn 0"),
  months: z.coerce.number().int().min(1, "Số kỳ tối thiểu là 1").max(60, "Số kỳ tối đa là 60"),
  feeAmount: z.preprocess(emptyToUndefined, z.coerce.number().min(0, "Phí không hợp lệ").default(0)),
  startDate: z.coerce.date().default(() => new Date()),
  transactionId: z.preprocess(emptyToUndefined, z.string().optional()),
  note: z.preprocess(emptyToUndefined, z.string().max(300).optional()),
});

/** Danh sách khoản trả góp (kèm tiến độ) của một thẻ hoặc toàn bộ thẻ. */
export async function getInstallments(walletId?: string) {
  const userId = await getUserId();
  let query = db.orm.public.CardInstallment.where((i) => i.userId.eq(userId));
  if (walletId) query = query.where({ walletId });
  const [rows, wallets] = await Promise.all([
    query.orderBy((i) => i.startDate.desc()).all(),
    db.orm.public.Wallet.where((w) => w.userId.eq(userId)).all(),
  ]);
  const statementDayOf = new Map((wallets as any[]).map((w) => [w.id, w.statementDay as number | null]));
  const now = new Date();

  return serializeData(
    (rows as any[]).map((i) => {
      const inst = {
        principal: Number(i.principal),
        months: Number(i.months),
        feeAmount: Number(i.feeAmount),
        startDate: toDate(i.startDate),
      };
      return {
        id: i.id,
        walletId: i.walletId,
        name: i.name,
        note: i.note ?? null,
        transactionId: i.transactionId ?? null,
        principal: inst.principal,
        months: inst.months,
        feeAmount: inst.feeAmount,
        startDate: inst.startDate.toISOString(),
        progress: getInstallmentProgress(inst, statementDayOf.get(i.walletId), now),
      };
    })
  ) as {
    id: string;
    walletId: string;
    name: string;
    note: string | null;
    transactionId: string | null;
    principal: number;
    months: number;
    feeAmount: number;
    startDate: string;
    progress: ReturnType<typeof getInstallmentProgress>;
  }[];
}

/** Các giao dịch chi tiêu của thẻ có thể chuyển đổi trả góp (chưa được chuyển đổi). */
export async function getInstallmentCandidates(walletId: string) {
  const userId = await getUserId();
  const [txs, existing] = await Promise.all([
    db.orm.public.Transaction
      .where({ userId, walletId, type: "EXPENSE" })
      .orderBy((t) => t.recordedAt.desc())
      .limit(50)
      .all(),
    db.orm.public.CardInstallment.where({ userId, walletId }).all(),
  ]);
  const used = new Set((existing as any[]).map((i) => i.transactionId).filter(Boolean));
  return serializeData(
    (txs as any[])
      .filter((t) => !used.has(t.id) && !String(t.note ?? "").startsWith("[TRANSFER]"))
      .map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        note: t.note ?? null,
        recordedAt: toDate(t.recordedAt).toISOString(),
      }))
  ) as { id: string; amount: number; note: string | null; recordedAt: string }[];
}

export async function createInstallment(formData: FormData) {
  const userId = await getUserId();
  const parsed = InstallmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const firstErr = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { error: firstErr || "Dữ liệu trả góp không hợp lệ" };
  }
  const data = parsed.data;

  const wallet = await db.orm.public.Wallet.where({ id: data.walletId, userId }).first();
  if (!wallet || getWalletKind(wallet) !== "CREDIT") {
    return { error: "Không tìm thấy thẻ tín dụng hợp lệ" };
  }

  if (data.transactionId) {
    const [sourceTx, existing] = await Promise.all([
      db.orm.public.Transaction.where({ id: data.transactionId, userId }).first(),
      db.orm.public.CardInstallment.where({ userId, transactionId: data.transactionId }).first(),
    ]);
    if (!sourceTx || sourceTx.walletId !== wallet.id || sourceTx.type !== "EXPENSE") {
      return { error: "Giao dịch gốc không hợp lệ hoặc không thuộc thẻ này" };
    }
    if (existing) {
      return { error: "Giao dịch này đã được chuyển đổi trả góp" };
    }
    // Gốc trả góp lớn hơn giao dịch gốc sẽ làm phần "chưa đến kỳ" vượt dư nợ thật → số tiền sao kê bị tính thiếu.
    if (toCents(data.principal) > toCents(sourceTx.amount)) {
      return { error: `Số tiền trả góp không được lớn hơn giao dịch gốc (${formatCurrency(Number(sourceTx.amount))})` };
    }
  } else {
    // Không gắn giao dịch: gốc trả góp phải nằm trong dư nợ hiện tại của thẻ.
    const txs = (await db.orm.public.Transaction
      .select("amount", "type")
      .where({ userId, walletId: wallet.id })
      .all()) as { amount: string | number; type: string }[];
    let balance = toCents(wallet.balance);
    for (const t of txs) {
      if (t.type === "INCOME") balance += toCents(t.amount);
      else if (t.type === "EXPENSE") balance -= toCents(t.amount);
    }
    const debt = Math.max(0, -balance);
    if (toCents(data.principal) > debt) {
      return {
        error: `Số tiền trả góp không được lớn hơn dư nợ hiện tại của thẻ (${formatCurrency(fromCents(debt))}). Hãy ghi nhận giao dịch chi tiêu trước.`,
      };
    }
  }

  const startInstant = toInstant(data.startDate);

  await db.transaction(async (tx: any) => {
    // Phí chuyển đổi là chi phí thực tế phát sinh trên thẻ (tăng dư nợ ngay khi chuyển đổi).
    let feeTransactionId: string | null = null;
    if (data.feeAmount > 0) {
      const expenseCats = (await tx.orm.public.Category
        .where({ userId, type: "EXPENSE" })
        .orderBy((c: any) => c.createdAt.asc())
        .all()) as any[];
      const feeCat =
        expenseCats.find((c) => c.name === "Chi tiêu khác") ??
        expenseCats.find((c) => c.name !== TRANSFER_CATEGORY_NAME);
      if (!feeCat) throw new Error("Chưa có danh mục chi tiêu để ghi nhận phí trả góp");
      const feeTx = await tx.orm.public.Transaction.create({
        amount: String(data.feeAmount),
        type: "EXPENSE",
        categoryId: feeCat.id,
        note: `Phí chuyển đổi trả góp: ${data.name}`,
        walletId: wallet.id,
        userId,
        recordedAt: startInstant,
      });
      feeTransactionId = feeTx.id;
    }

    await tx.orm.public.CardInstallment.create({
      name: data.name,
      principal: String(data.principal),
      months: data.months,
      feeAmount: String(data.feeAmount),
      startDate: startInstant,
      transactionId: data.transactionId ?? null,
      feeTransactionId,
      note: data.note ?? null,
      walletId: wallet.id,
      userId,
    });
  });

  revalidatePath("/", "layout");
  return { success: true as const };
}

/** Xóa khoản trả góp; giao dịch phí chuyển đổi đi kèm (nếu có) cũng bị xóa để dư nợ khớp lại. */
export async function deleteInstallment(id: string) {
  const userId = await getUserId();
  const inst = await db.orm.public.CardInstallment.where({ id, userId }).first();
  if (!inst) return { error: "Không tìm thấy khoản trả góp" };

  await db.transaction(async (tx: any) => {
    if (inst.feeTransactionId) {
      await tx.orm.public.Transaction.where({ id: inst.feeTransactionId, userId }).delete();
    }
    await tx.orm.public.CardInstallment.where({ id, userId }).delete();
  });

  revalidatePath("/", "layout");
  return { success: true as const };
}
