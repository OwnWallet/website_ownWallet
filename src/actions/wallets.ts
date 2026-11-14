"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { serializeData, toInstant } from "@/lib/utils";
import { isTransfer, TRANSFER_CATEGORY_NAME } from "@/lib/finance";

const WalletSchema = z.object({
  name: z.string().min(1, "Tên tài khoản không được để trống").max(50),
  bankName: z.string().max(50).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  balance: z.coerce.number().default(0),
  color: z.string().default("#7c3aed"),
  icon: z.string().default("Landmark"),
  isDefault: z.coerce.boolean().default(false),
});

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

async function getOrCreateTransferCategory(tx: any, userId: string, type: "EXPENSE" | "INCOME") {
  const existing = await tx.orm.public.Category
    .where({ userId, type, name: TRANSFER_CATEGORY_NAME })
    .first();
  if (existing) return existing;
  return tx.orm.public.Category.create({
    name: TRANSFER_CATEGORY_NAME,
    type,
    color: "#64748b",
    icon: "🔁",
    userId,
  });
}

export async function getWallets() {
  const userId = await getUserId();
  const [rawWallets, txs] = await Promise.all([
    db.orm.public.Wallet
      .where((w) => w.userId.eq(userId))
      .orderBy((w) => w.createdAt.asc())
      .all(),
    db.orm.public.Transaction
      .select("amount", "type", "walletId", "note")
      .where((t) => t.userId.eq(userId))
      .all(),
  ]);

  // No auto-seeding: a user with no wallets sees an empty state, and
  // unassigned transactions stay unassigned.
  const wallets = rawWallets;

  // income/expense are REAL flows (transfers excluded). Transfers are tracked
  // separately because they still move this wallet's balance.
  type Stat = { income: number; expense: number; transferIn: number; transferOut: number; txCount: number };
  const emptyStat = (): Stat => ({ income: 0, expense: 0, transferIn: 0, transferOut: 0, txCount: 0 });
  const walletStats = new Map<string, Stat>();
  for (const t of txs) {
    const wId = t.walletId || "UNASSIGNED";
    if (!walletStats.has(wId)) walletStats.set(wId, emptyStat());
    const stat = walletStats.get(wId)!;
    stat.txCount++;
    const amt = Number(t.amount);
    const transfer = isTransfer(t);
    if (t.type === "INCOME") {
      if (transfer) stat.transferIn += amt;
      else stat.income += amt;
    } else if (t.type === "EXPENSE") {
      if (transfer) stat.transferOut += amt;
      else stat.expense += amt;
    }
  }

  const walletsWithStats = wallets.map((w: any) => {
    const stat = walletStats.get(w.id) || emptyStat();
    const currentBalance =
      Number(w.balance) + stat.income - stat.expense + stat.transferIn - stat.transferOut;
    return {
      ...w,
      balance: Number(w.balance),
      currentBalance,
      income: stat.income,
      expense: stat.expense,
      transferIn: stat.transferIn,
      transferOut: stat.transferOut,
      txCount: stat.txCount,
    };
  });

  return serializeData(walletsWithStats);
}

export async function createWallet(formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = WalletSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Nếu đánh dấu isDefault, bỏ default của các ví khác
  if (data.isDefault) {
    const userWallets = await db.orm.public.Wallet.where((w) => w.userId.eq(userId)).all();
    for (const uw of userWallets) {
      if (uw.isDefault) {
        await db.orm.public.Wallet.where({ id: uw.id }).update({ isDefault: false });
      }
    }
  }

  await db.orm.public.Wallet.create({
    name: data.name,
    bankName: data.bankName || null,
    accountNumber: data.accountNumber || null,
    balance: String(data.balance),
    color: data.color,
    icon: data.icon,
    isDefault: data.isDefault,
    userId,
  });

  // Wallet balances feed every finance page (dashboard, reports, budget, income...).
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateWallet(id: string, formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = WalletSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  if (data.isDefault) {
    const userWallets = await db.orm.public.Wallet.where((w) => w.userId.eq(userId)).all();
    for (const uw of userWallets) {
      if (uw.id !== id && uw.isDefault) {
        await db.orm.public.Wallet.where({ id: uw.id }).update({ isDefault: false });
      }
    }
  }

  await db.orm.public.Wallet
    .where({ id, userId })
    .update({
      name: data.name,
      bankName: data.bankName || null,
      accountNumber: data.accountNumber || null,
      balance: String(data.balance),
      color: data.color,
      icon: data.icon,
      isDefault: data.isDefault,
    });

  // Wallet balances feed every finance page (dashboard, reports, budget, income...).
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteWallet(id: string) {
  const userId = await getUserId();

  await db.transaction(async (tx: any) => {
    // Đặt walletId của các giao dịch liên quan về null trước khi xóa
    const relatedTxs = await tx.orm.public.Transaction
      .where({ userId, walletId: id })
      .all();

    for (const t of relatedTxs) {
      await tx.orm.public.Transaction.where({ id: t.id }).update({ walletId: null });
    }

    // Đặt walletId của các nguồn dòng tiền định kỳ về null để tránh lỗi Foreign Key
    const relatedSources = await tx.orm.public.CashFlowSource
      .where({ userId, walletId: id })
      .all();

    for (const s of relatedSources) {
      await tx.orm.public.CashFlowSource.where({ id: s.id }).update({ walletId: null });
    }

    await tx.orm.public.Wallet.where({ id, userId }).delete();
  });

  // Wallet balances feed every finance page (dashboard, reports, budget, income...).
  revalidatePath("/", "layout");
  return { success: true };
}

export async function reassignTransactions(fromWalletId: string | "UNASSIGNED", toWalletId: string) {
  const userId = await getUserId();

  // Kiểm tra quyền sở hữu ví đích để chống IDOR
  const targetWallet = await db.orm.public.Wallet.where({ id: toWalletId, userId }).first();
  if (!targetWallet) {
    return { error: "Ví đích không tồn tại hoặc không thuộc quyền sở hữu" };
  }

  const txs = fromWalletId === "UNASSIGNED"
    ? await db.orm.public.Transaction.where({ userId, walletId: null }).all()
    : await db.orm.public.Transaction.where({ userId, walletId: fromWalletId }).all();

  await db.transaction(async (tx: any) => {
    for (const t of txs) {
      await tx.orm.public.Transaction.where({ id: t.id, userId }).update({ walletId: toWalletId });
    }
  });

  // Wallet balances feed every finance page (dashboard, reports, budget, income...).
  revalidatePath("/", "layout");
  return { success: true };
}

const TransferSchema = z.object({
  fromWalletId: z.string().min(1, "Vui lòng chọn ví nguồn"),
  toWalletId: z.string().min(1, "Vui lòng chọn ví đích"),
  amount: z.coerce.number().positive("Số tiền chuyển phải lớn hơn 0"),
  fee: z.coerce.number().min(0, "Phí chuyển không hợp lệ").default(0),
  note: z.string().max(300).optional(),
  recordedAt: z.coerce.date().default(() => new Date()),
});

export async function transferBetweenWallets(formData: FormData) {
  const userId = await getUserId();
  const parsed = TransferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const firstErr = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { error: firstErr || "Dữ liệu chuyển khoản không hợp lệ" };
  }

  const { fromWalletId, toWalletId, amount, fee, note, recordedAt } = parsed.data;
  if (fromWalletId === toWalletId) {
    return { error: "Ví nguồn và ví đích không được trùng nhau" };
  }

  const [fromWallet, toWallet] = await Promise.all([
    db.orm.public.Wallet.where({ id: fromWalletId, userId }).first(),
    db.orm.public.Wallet.where({ id: toWalletId, userId }).first(),
  ]);

  if (!fromWallet || !toWallet) {
    return { error: "Không tìm thấy ví nguồn hoặc ví đích hợp lệ" };
  }

  const recordedInstant = toInstant(recordedAt);
  const customNote = note?.trim() ? ` - ${note.trim()}` : "";

  await db.transaction(async (tx: any) => {
    // Dedicated "Chuyển khoản nội bộ" categories (one per type) so transfers never
    // land in a real spending/income category (e.g. "Ăn uống") and skew budgets.
    const transferOutCat = await getOrCreateTransferCategory(tx, userId, "EXPENSE");
    const transferInCat = await getOrCreateTransferCategory(tx, userId, "INCOME");

    // 1. Ghi giảm Ví nguồn (EXPENSE)
    await tx.orm.public.Transaction.create({
      amount: String(amount),
      type: "EXPENSE",
      categoryId: transferOutCat.id,
      note: `[TRANSFER] Chuyển tiền sang ${toWallet.name}${customNote}`,
      walletId: fromWallet.id,
      userId,
      recordedAt: recordedInstant,
    });

    // 2. Ghi tăng Ví đích (INCOME)
    await tx.orm.public.Transaction.create({
      amount: String(amount),
      type: "INCOME",
      categoryId: transferInCat.id,
      note: `[TRANSFER] Nhận tiền từ ${fromWallet.name}${customNote}`,
      walletId: toWallet.id,
      userId,
      recordedAt: recordedInstant,
    });

    // 3. Nếu có phí chuyển khoản, ghi 1 khoản chi phí thực tế ở Ví nguồn
    if (fee > 0) {
      // The fee is real spending: book it under a regular EXPENSE category
      // (not the transfer one, which is excluded from totals).
      const expenseCats = (await tx.orm.public.Category
        .where({ userId, type: "EXPENSE" })
        .orderBy((c: any) => c.createdAt.asc())
        .all()) as any[];
      const feeCat = expenseCats.find((c) => c.name !== TRANSFER_CATEGORY_NAME) ?? transferOutCat;
      await tx.orm.public.Transaction.create({
        amount: String(fee),
        type: "EXPENSE",
        categoryId: feeCat.id,
        note: `Phí chuyển khoản từ ${fromWallet.name} sang ${toWallet.name}`,
        walletId: fromWallet.id,
        userId,
        recordedAt: recordedInstant,
      });
    }
  });

  // Wallet balances feed every finance page (dashboard, reports, budget, income...).
  revalidatePath("/", "layout");
  return {
    success: true,
    fromName: fromWallet.name,
    toName: toWallet.name,
    amount,
    fee,
  };
}
