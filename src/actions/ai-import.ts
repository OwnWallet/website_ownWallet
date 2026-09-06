"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toInstant } from "@/lib/utils";
import { ConfirmImportSchema } from "@/schemas/ai-import";
import { revalidatePath } from "next/cache";

export interface ImportResult {
  success: boolean;
  imported: number;
  error?: string;
}

/**
 * Bulk-insert các giao dịch sau khi user xem xét và confirm.
 * Tự động tạo category mới nếu chưa tồn tại.
 */
export async function confirmAiImport(
  rawPayload: unknown
): Promise<ImportResult> {
  // ── Auth ──
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, imported: 0, error: "Chưa đăng nhập." };
  }
  const userId = session.user.id;

  // ── Validate payload ──
  const parsed = ConfirmImportSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      success: false,
      imported: 0,
      error: "Dữ liệu không hợp lệ: " + parsed.error.message,
    };
  }

  const { transactions, walletId } = parsed.data;

  // ── Lấy toàn bộ categories của user ──
  const existingCategories = await db.orm.public.Category
    .select("id", "name")
    .where({ userId })
    .all();

  const categoryMap = new Map<string, string>(
    existingCategories.map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
  );

  // ── Tạo categories mới nếu cần ──
  const missingCategoryNames = [
    ...new Set(
      transactions
        .map((t) => t.categoryName.toLowerCase())
        .filter((name) => !categoryMap.has(name))
    ),
  ];

  if (missingCategoryNames.length > 0) {
    // Xác định type cho category mới dựa theo loại giao dịch đầu tiên dùng nó
    for (const name of missingCategoryNames) {
      const firstUse = transactions.find(
        (t) => t.categoryName.toLowerCase() === name
      );
      const catType = firstUse?.type === "INCOME" ? "INCOME" : "EXPENSE";

      try {
        const newCat = await db.orm.public.Category.create({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          type: catType,
          color: "#94a3b8",
          icon: "📦",
          isDefault: false,
          userId,
        });
        categoryMap.set(name, newCat.id);
      } catch {
        // Category đã tồn tại (race condition) — tìm lại
        const existing = await db.orm.public.Category
          .where({ userId })
          .first();
        if (existing) {
          categoryMap.set(name, existing.id);
        }
      }
    }
  }

  // ── Bulk insert transactions ──
  const transactionData = transactions.map((t) => {
    const catId = categoryMap.get(t.categoryName.toLowerCase());
    if (!catId) {
      throw new Error(`Không tìm thấy category: ${t.categoryName}`);
    }
    return {
      amount: String(t.amount),
      type: t.type,
      note: t.note ?? "",
      recordedAt: toInstant(t.recordedAt),
      categoryId: catId,
      walletId: walletId || null,
      userId,
    };
  });

  try {
    // Prisma 8 không có createMany — insert từng record
    for (const txData of transactionData) {
      await db.orm.public.Transaction.create(txData);
    }

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/wallets");

    return { success: true, imported: transactionData.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return { success: false, imported: 0, error: message };
  }
}
