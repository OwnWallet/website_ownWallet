"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { serializeData, toInstant } from "@/lib/utils";

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

/**
 * Tự động tạo 3 tài khoản mặc định (2 TPBank, 1 Techcombank) nếu user chưa có ví nào
 * Đồng thời tự động liên kết các giao dịch cũ (nếu có) vào TPBank - TK 1
 */
export async function ensureDefaultWallets(userId: string) {
  const existingWallets = await db.orm.public.Wallet
    .where((w) => w.userId.eq(userId))
    .all();

  if (existingWallets.length > 0) {
    return existingWallets;
  }

  // Tạo 3 tài khoản mặc định
  const defaultWallets = [
    {
      name: "TPBank - TK 1",
      bankName: "TPBank",
      accountNumber: "",
      balance: "0",
      color: "#7c3aed", // Tím TPBank
      icon: "Landmark",
      isDefault: true,
      userId,
    },
    {
      name: "TPBank - TK 2",
      bankName: "TPBank",
      accountNumber: "",
      balance: "0",
      color: "#a855f7", // Tím nhạt TPBank
      icon: "CreditCard",
      isDefault: false,
      userId,
    },
    {
      name: "Techcombank",
      bankName: "Techcombank",
      accountNumber: "",
      balance: "0",
      color: "#ef4444", // Đỏ Techcombank
      icon: "Building2",
      isDefault: false,
      userId,
    },
  ];

  const createdWallets = [];
  for (const w of defaultWallets) {
    const created = await db.orm.public.Wallet.create(w);
    createdWallets.push(created);
  }

  // Tự động gán các giao dịch chưa có walletId vào TPBank - TK 1 (vì trích xuất từ sao kê TPBank)
  if (createdWallets[0]?.id) {
    const primaryId = createdWallets[0].id;
    const unassigned = await db.orm.public.Transaction
      .where({ userId, walletId: null })
      .all();

    for (const tx of unassigned) {
      await db.orm.public.Transaction.where({ id: tx.id }).update({ walletId: primaryId });
    }
  }

  return createdWallets;
}

export async function getWallets() {
  const userId = await getUserId();
  const [rawWallets, txs] = await Promise.all([
    db.orm.public.Wallet
      .where((w) => w.userId.eq(userId))
      .orderBy((w) => w.createdAt.asc())
      .all(),
    db.orm.public.Transaction
      .select("amount", "type", "walletId")
      .where((t) => t.userId.eq(userId))
      .all(),
  ]);

  let wallets = rawWallets;
  if (wallets.length === 0) {
    wallets = await ensureDefaultWallets(userId);
  }

  const walletStats = new Map<string, { income: number; expense: number; txCount: number }>();
  for (const t of txs) {
    const wId = t.walletId || "UNASSIGNED";
    if (!walletStats.has(wId)) {
      walletStats.set(wId, { income: 0, expense: 0, txCount: 0 });
    }
    const stat = walletStats.get(wId)!;
    stat.txCount++;
    if (t.type === "INCOME") {
      stat.income += Number(t.amount);
    } else {
      stat.expense += Number(t.amount);
    }
  }

  const walletsWithStats = wallets.map((w: any) => {
    const stat = walletStats.get(w.id) || { income: 0, expense: 0, txCount: 0 };
    const currentBalance = Number(w.balance) + stat.income - stat.expense;
    return {
      ...w,
      balance: Number(w.balance),
      currentBalance,
      income: stat.income,
      expense: stat.expense,
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

  revalidatePath("/wallets");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
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

  revalidatePath("/wallets");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
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

  revalidatePath("/wallets");
  revalidatePath("/transactions");
  revalidatePath("/income");
  revalidatePath("/dashboard");
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

  revalidatePath("/wallets");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
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
    // Tìm hoặc tạo danh mục Chuyển khoản nội bộ
    const expenseCat = await tx.orm.public.Category
      .where({ userId, type: "EXPENSE" })
      .first();
    const incomeCat = await tx.orm.public.Category
      .where({ userId, type: "INCOME" })
      .first();
    const fallbackCat = expenseCat || incomeCat || (await tx.orm.public.Category.where({ userId }).first());

    if (!fallbackCat) {
      throw new Error("Không tìm thấy danh mục giao dịch");
    }

    // 1. Ghi giảm Ví nguồn (EXPENSE)
    await tx.orm.public.Transaction.create({
      amount: String(amount),
      type: "EXPENSE",
      categoryId: (expenseCat || fallbackCat).id,
      note: `[TRANSFER] Chuyển tiền sang ${toWallet.name}${customNote}`,
      walletId: fromWallet.id,
      userId,
      recordedAt: recordedInstant,
    });

    // 2. Ghi tăng Ví đích (INCOME)
    await tx.orm.public.Transaction.create({
      amount: String(amount),
      type: "INCOME",
      categoryId: (incomeCat || fallbackCat).id,
      note: `[TRANSFER] Nhận tiền từ ${fromWallet.name}${customNote}`,
      walletId: toWallet.id,
      userId,
      recordedAt: recordedInstant,
    });

    // 3. Nếu có phí chuyển khoản, ghi 1 khoản chi phí thực tế ở Ví nguồn
    if (fee > 0) {
      await tx.orm.public.Transaction.create({
        amount: String(fee),
        type: "EXPENSE",
        categoryId: (expenseCat || fallbackCat).id,
        note: `Phí chuyển khoản từ ${fromWallet.name} sang ${toWallet.name}`,
        walletId: fromWallet.id,
        userId,
        recordedAt: recordedInstant,
      });
    }
  });

  revalidatePath("/wallets");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return {
    success: true,
    fromName: fromWallet.name,
    toName: toWallet.name,
    amount,
    fee,
  };
}
