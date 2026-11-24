"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { serializeData, toDate, toInstant } from "@/lib/utils";
import { isTransfer, TRANSFER_CATEGORY_NAME } from "@/lib/finance";
import {
  getCreditDebt,
  getCreditUtilization,
  getInstallmentProgress,
  getStatementSummary,
  getWalletKind,
  type CardTx,
  type InstallmentLike,
} from "@/lib/credit-card";
import { fromCents, subMoney, sumMoney, toCents } from "@/lib/money";
import { getOrCreateTransferCategory } from "@/lib/transfer-category";

/** "" / null / undefined → undefined, để các trường số tùy chọn từ FormData không bị ép thành 0. */
const emptyToUndefined = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);

const WalletSchema = z
  .object({
    name: z.string().min(1, "Tên tài khoản không được để trống").max(50),
    type: z.enum(["BANK", "CASH", "CREDIT"]).default("BANK"),
    bankName: z.string().max(50).optional().nullable(),
    accountNumber: z.string().max(50).optional().nullable(),
    balance: z.coerce.number().default(0),
    // Thẻ tín dụng: nhập dư nợ hiện tại (số dương) thay cho số dư ban đầu.
    openingDebt: z.preprocess(emptyToUndefined, z.coerce.number().min(0, "Dư nợ không hợp lệ").optional()),
    creditLimit: z.preprocess(emptyToUndefined, z.coerce.number().min(0, "Hạn mức không hợp lệ").optional()),
    statementDay: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1, "Ngày chốt sao kê từ 1 - 31").max(31, "Ngày chốt sao kê từ 1 - 31").optional()
    ),
    paymentDueDay: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1, "Ngày đến hạn từ 1 - 31").max(31, "Ngày đến hạn từ 1 - 31").optional()
    ),
    color: z.string().default("#7c3aed"),
    icon: z.string().default("Landmark"),
    isDefault: z.coerce.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.type !== "CREDIT") return;
    if (!d.creditLimit || d.creditLimit <= 0) {
      ctx.addIssue({ code: "custom", path: ["creditLimit"], message: "Vui lòng nhập hạn mức tín dụng" });
    }
    if (!d.statementDay) {
      ctx.addIssue({ code: "custom", path: ["statementDay"], message: "Vui lòng nhập ngày chốt sao kê" });
    }
  });

type WalletInput = z.infer<typeof WalletSchema>;

/** Chuẩn hóa dữ liệu ghi DB theo loại ví (xóa trường thẻ ở ví thường, lưu dư nợ thẻ dưới dạng số dư âm). */
function toWalletRecord(data: WalletInput) {
  const isCredit = data.type === "CREDIT";
  const balance = isCredit ? -(data.openingDebt ?? Math.max(0, -data.balance)) : data.balance;
  return {
    name: data.name,
    type: data.type,
    bankName: data.type === "CASH" ? "CASH" : data.bankName || null,
    accountNumber: data.type === "CASH" ? null : data.accountNumber || null,
    balance: String(balance),
    creditLimit: isCredit && data.creditLimit ? String(data.creditLimit) : null,
    statementDay: isCredit ? data.statementDay ?? null : null,
    paymentDueDay: isCredit ? data.paymentDueDay ?? null : null,
    color: data.color,
    icon: isCredit ? "CreditCard" : data.icon,
    isDefault: data.isDefault,
  };
}

function firstFieldError(error: z.ZodError): string {
  const fieldErrors = Object.values(error.flatten().fieldErrors) as (string[] | undefined)[];
  return fieldErrors.find((e) => e && e.length)?.[0] || "Vui lòng kiểm tra lại thông tin";
}

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}


export async function getWallets() {
  const userId = await getUserId();
  const [rawWallets, txs, installments] = await Promise.all([
    db.orm.public.Wallet
      .where((w) => w.userId.eq(userId))
      .orderBy((w) => w.createdAt.asc())
      .all(),
    db.orm.public.Transaction
      .select("amount", "type", "walletId", "note", "recordedAt")
      .where((t) => t.userId.eq(userId))
      .all(),
    db.orm.public.CardInstallment
      .where((i) => i.userId.eq(userId))
      .all(),
  ]);

  // Giao dịch & trả góp theo từng thẻ tín dụng (để tính kỳ sao kê).
  const creditIds = new Set(
    (rawWallets as any[]).filter((w) => getWalletKind(w) === "CREDIT").map((w) => w.id)
  );
  const cardTxs = new Map<string, CardTx[]>();
  const now = new Date();
  for (const t of txs as any[]) {
    if (!t.walletId || !creditIds.has(t.walletId)) continue;
    if (!cardTxs.has(t.walletId)) cardTxs.set(t.walletId, []);
    cardTxs.get(t.walletId)!.push({ amount: Number(t.amount), type: t.type, recordedAt: toDate(t.recordedAt) });
  }
  const cardInstallments = new Map<string, InstallmentLike[]>();
  for (const i of installments as any[]) {
    if (!cardInstallments.has(i.walletId)) cardInstallments.set(i.walletId, []);
    cardInstallments.get(i.walletId)!.push({
      principal: Number(i.principal),
      months: Number(i.months),
      feeAmount: Number(i.feeAmount),
      startDate: toDate(i.startDate),
    });
  }

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
    // Cộng bằng xu (số nguyên) để số dư chính xác tuyệt đối
    const amt = toCents(t.amount);
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
    const currentBalance = fromCents(
      toCents(w.balance) + stat.income - stat.expense + stat.transferIn - stat.transferOut
    );
    const kind = getWalletKind(w);
    let credit = null;
    if (kind === "CREDIT") {
      const creditLimit = Number(w.creditLimit ?? 0);
      const creditDebt = getCreditDebt(currentBalance);
      const insts = cardInstallments.get(w.id) || [];
      const summary = getStatementSummary(
        { initialBalance: Number(w.balance), statementDay: w.statementDay, paymentDueDay: w.paymentDueDay },
        cardTxs.get(w.id) || [],
        insts,
        now
      );
      const activeInstallments = insts
        .map((i) => getInstallmentProgress(i, w.statementDay, now))
        .filter((p) => !p.isCompleted);
      credit = {
        creditLimit,
        creditDebt,
        availableCredit: subMoney(creditLimit, creditDebt),
        utilization: getCreditUtilization(creditDebt, creditLimit),
        activeInstallmentCount: activeInstallments.length,
        installmentRemaining: sumMoney(activeInstallments.map((p) => p.remainingAmount)),
        statement: {
          lastStatementDate: summary.lastStatementDate.toISOString(),
          nextStatementDate: summary.nextStatementDate.toISOString(),
          dueDate: summary.dueDate.toISOString(),
          daysUntilDue: summary.daysUntilDue,
          daysUntilNextStatement: summary.daysUntilNextStatement,
          statementAmount: summary.statementAmount,
          paidSinceStatement: summary.paidSinceStatement,
          remainingDue: summary.remainingDue,
          installmentDueThisStatement: summary.installmentDueThisStatement,
          status: summary.status,
        },
      };
    }
    return {
      ...w,
      type: kind,
      creditLimit: w.creditLimit != null ? Number(w.creditLimit) : null,
      credit,
      balance: Number(w.balance),
      currentBalance,
      income: fromCents(stat.income),
      expense: fromCents(stat.expense),
      transferIn: fromCents(stat.transferIn),
      transferOut: fromCents(stat.transferOut),
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
    return { error: parsed.error.flatten().fieldErrors, message: firstFieldError(parsed.error) };
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
    ...toWalletRecord(data),
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
    return { error: parsed.error.flatten().fieldErrors, message: firstFieldError(parsed.error) };
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
    .update(toWalletRecord(data));

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

type TransferInput = z.infer<typeof TransferSchema>;
type TransferMode = "TRANSFER" | "CARD_PAYMENT";

/** Danh mục chi tiêu thường để ghi nhận phí (không dùng danh mục chuyển khoản vì bị loại khỏi tổng chi). */
async function getFeeExpenseCategory(tx: any, userId: string, fallback: any) {
  const expenseCats = (await tx.orm.public.Category
    .where({ userId, type: "EXPENSE" })
    .orderBy((c: any) => c.createdAt.asc())
    .all()) as any[];
  return (
    expenseCats.find((c) => c.name === "Chi tiêu khác") ??
    expenseCats.find((c) => c.name !== TRANSFER_CATEGORY_NAME) ??
    fallback
  );
}

/**
 * Lõi chuyển tiền nội bộ: tạo cặp giao dịch [TRANSFER] (bị loại khỏi tổng thu/chi)
 * và một giao dịch phí thực tế nếu có. Dùng chung cho chuyển ví và thanh toán thẻ tín dụng.
 */
async function performTransfer(userId: string, input: TransferInput, mode: TransferMode) {
  const { fromWalletId, toWalletId, amount, fee, note, recordedAt } = input;
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

  if (mode === "CARD_PAYMENT") {
    if (getWalletKind(toWallet) !== "CREDIT") {
      return { error: "Tài khoản nhận thanh toán phải là thẻ tín dụng" };
    }
    if (getWalletKind(fromWallet) === "CREDIT") {
      return { error: "Không thể thanh toán thẻ tín dụng bằng một thẻ tín dụng khác" };
    }
  }

  const recordedInstant = toInstant(recordedAt);
  const customNote = note?.trim() ? ` - ${note.trim()}` : "";
  const outNote =
    mode === "CARD_PAYMENT"
      ? `[TRANSFER] Thanh toán thẻ tín dụng ${toWallet.name}${customNote}`
      : `[TRANSFER] Chuyển tiền sang ${toWallet.name}${customNote}`;
  const inNote =
    mode === "CARD_PAYMENT"
      ? `[TRANSFER] Nhận thanh toán thẻ từ ${fromWallet.name}${customNote}`
      : `[TRANSFER] Nhận tiền từ ${fromWallet.name}${customNote}`;

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
      note: outNote,
      walletId: fromWallet.id,
      userId,
      recordedAt: recordedInstant,
    });

    // 2. Ghi tăng Ví đích (INCOME) — với thẻ tín dụng: giảm dư nợ
    await tx.orm.public.Transaction.create({
      amount: String(amount),
      type: "INCOME",
      categoryId: transferInCat.id,
      note: inNote,
      walletId: toWallet.id,
      userId,
      recordedAt: recordedInstant,
    });

    // 3. Nếu có phí chuyển khoản, ghi 1 khoản chi phí thực tế ở Ví nguồn
    if (fee > 0) {
      // The fee is real spending: book it under a regular EXPENSE category
      // (not the transfer one, which is excluded from totals).
      const feeCat = await getFeeExpenseCategory(tx, userId, transferOutCat);
      await tx.orm.public.Transaction.create({
        amount: String(fee),
        type: "EXPENSE",
        categoryId: feeCat.id,
        note:
          mode === "CARD_PAYMENT"
            ? `Phí thanh toán thẻ ${toWallet.name} từ ${fromWallet.name}`
            : `Phí chuyển khoản từ ${fromWallet.name} sang ${toWallet.name}`,
        walletId: fromWallet.id,
        userId,
        recordedAt: recordedInstant,
      });
    }
  });

  // Wallet balances feed every finance page (dashboard, reports, budget, income...).
  revalidatePath("/", "layout");
  return {
    success: true as const,
    fromName: fromWallet.name,
    toName: toWallet.name,
    amount,
    fee,
  };
}

export async function transferBetweenWallets(formData: FormData) {
  const userId = await getUserId();
  const parsed = TransferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const firstErr = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { error: firstErr || "Dữ liệu chuyển khoản không hợp lệ" };
  }
  return performTransfer(userId, parsed.data, "TRANSFER");
}

/**
 * Thanh toán dư nợ thẻ tín dụng từ một tài khoản ngân hàng / ví tiền mặt.
 * Ghi như chuyển khoản nội bộ nên không bị tính là chi tiêu (khoản chi đã được tính lúc quẹt thẻ).
 */
export async function payCreditCard(formData: FormData) {
  const userId = await getUserId();
  const parsed = TransferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const firstErr = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { error: firstErr || "Dữ liệu thanh toán không hợp lệ" };
  }
  return performTransfer(userId, parsed.data, "CARD_PAYMENT");
}
