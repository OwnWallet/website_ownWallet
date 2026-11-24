"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toInstant } from "@/lib/utils";
import { ConfirmImportSchema } from "@/schemas/ai-import";
import { revalidatePath } from "next/cache";
import { collectCorrections } from "@/lib/category-rules";
import { upsertCategoryRules, reinforceCategoryRules } from "@/lib/category-rules-db";
import { TRANSFER_CATEGORY_NAME, TRANSFER_PREFIX } from "@/lib/finance";
import { getOrCreateTransferCategory } from "@/lib/transfer-category";

export interface ImportResult {
  success: boolean;
  imported: number;
  /** Số quy tắc phân loại mới học được từ các lần sửa danh mục */
  learnedRules?: number;
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
    // Thông báo dễ hiểu thay vì JSON lỗi thô của Zod
    const rows = new Set<number>();
    let missingCategory = 0;
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "transactions" && typeof issue.path[1] === "number") {
        rows.add(issue.path[1] + 1);
        if (issue.path[2] === "categoryName") missingCategory++;
      }
    }
    const rowList = [...rows].slice(0, 5).join(", ") + (rows.size > 5 ? "…" : "");
    return {
      success: false,
      imported: 0,
      error:
        missingCategory > 0
          ? `Có ${missingCategory} giao dịch chưa chọn danh mục (dòng ${rowList}). Vui lòng chọn danh mục rồi thử lại.`
          : rows.size > 0
          ? `Dữ liệu giao dịch không hợp lệ ở dòng ${rowList}.`
          : parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ.",
    };
  }

  const { walletId } = parsed.data;
  // Dòng chọn danh mục "Chuyển khoản nội bộ" cũng là chuyển khoản, để luôn được loại khỏi tổng thu/chi.
  const transactions = parsed.data.transactions.map((t) => {
    const isTransfer =
      t.isTransfer || t.categoryName.trim().toLowerCase() === TRANSFER_CATEGORY_NAME.toLowerCase();
    return isTransfer ? { ...t, isTransfer: true, categoryName: TRANSFER_CATEGORY_NAME } : { ...t, isTransfer: false };
  });
  const regularTransactions = transactions.filter((t) => !t.isTransfer);

  // Kiểm tra quyền sở hữu ví nếu có truyền walletId để chống IDOR
  let validatedWalletId: string | null = null;
  if (walletId) {
    const wallet = await db.orm.public.Wallet.where({ id: walletId, userId }).first();
    if (!wallet) {
      return { success: false, imported: 0, error: "Ví được chọn không tồn tại hoặc không thuộc quyền sở hữu." };
    }
    validatedWalletId = wallet.id;
  }

  // ── Lấy toàn bộ categories của user ──
  const existingCategories = await db.orm.public.Category
    .select("id", "name")
    .where({ userId })
    .all();

  const categoryMap = new Map<string, string>(
    existingCategories.map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
  );

  // ── Danh mục chuyển khoản nội bộ (một danh mục dùng chung cho cả chiều vào / ra) ──
  const firstTransfer = transactions.find((t) => t.isTransfer);
  if (firstTransfer) {
    const transferCat = await getOrCreateTransferCategory(db, userId, firstTransfer.type);
    categoryMap.set(TRANSFER_CATEGORY_NAME.toLowerCase(), transferCat.id);
  }

  // ── Tạo categories mới nếu cần ──
  const missingCategoryNames = [
    ...new Set(
      regularTransactions
        .map((t) => t.categoryName.toLowerCase())
        .filter((name) => !categoryMap.has(name))
    ),
  ];

  if (missingCategoryNames.length > 0) {
    // Xác định type cho category mới dựa theo loại giao dịch đầu tiên dùng nó
    for (const name of missingCategoryNames) {
      const firstUse = regularTransactions.find(
        (t) => t.categoryName.toLowerCase() === name
      );
      const isDebt = /(^|\s)(nợ|vay|mượn)(\s|$)/.test(name);
      const catType = isDebt ? "DEBT" : firstUse?.type === "INCOME" ? "INCOME" : "EXPENSE";
      // Giữ nguyên cách viết gốc (VD: "GrabFood"), chỉ viết hoa chữ cái đầu
      const original = firstUse?.categoryName.trim() || name;
      const displayName = original.charAt(0).toUpperCase() + original.slice(1);

      try {
        const newCat = await db.orm.public.Category.create({
          name: displayName,
          type: catType,
          color: isDebt ? "#f59e0b" : "#94a3b8",
          icon: isDebt ? "🤝" : "📦",
          isDefault: false,
          userId,
        });
        categoryMap.set(name, newCat.id);
      } catch {
        // Category đã tồn tại (race condition) — tìm lại đúng theo tên thay vì lấy ngẫu nhiên
        const existing = await db.orm.public.Category
          .where({ userId, name: displayName })
          .first();
        if (existing) {
          categoryMap.set(name, existing.id);
        } else {
          // Fallback tìm kiếm case-insensitive
          const allCats = await db.orm.public.Category.where({ userId }).all();
          const match = allCats.find((c: any) => c.name.toLowerCase() === name);
          if (match) {
            categoryMap.set(name, match.id);
          }
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
    const note = (t.note ?? "").trim();
    return {
      amount: String(t.amount),
      type: t.type,
      note: t.isTransfer && !note.startsWith(TRANSFER_PREFIX) ? `${TRANSFER_PREFIX} ${note}`.trim() : note,
      recordedAt: toInstant(t.recordedAt),
      categoryId: catId,
      walletId: validatedWalletId,
      userId,
    };
  });

  try {
    await db.transaction(async (tx: any) => {
      for (const txData of transactionData) {
        await tx.orm.public.Transaction.create(txData);
      }
    });

    // Số dư ví / thẻ tín dụng ảnh hưởng mọi trang tài chính
    revalidatePath("/", "layout");

    // ── Học quy tắc phân loại từ các dòng người dùng đã sửa danh mục ──
    // (không làm hỏng kết quả import nếu bước học gặp lỗi)
    let learnedRules = 0;
    try {
      // Không học quy tắc từ các dòng chuyển khoản nội bộ
      const corrections = collectCorrections(regularTransactions);
      learnedRules = await upsertCategoryRules(
        userId,
        corrections
          .map((c) => ({ ...c, categoryId: categoryMap.get(c.categoryName.toLowerCase()) ?? "" }))
          .filter((c) => c.categoryId)
      );

      // Quy tắc được áp dụng và người dùng giữ nguyên → tăng độ tin cậy
      const kept = regularTransactions
        .filter((t) => t.ruleKeyword && t.categoryName === t.suggestedCategoryName)
        .map((t) => ({ keyword: t.ruleKeyword!, txType: t.type }));
      const uniqueKept = [...new Map(kept.map((k) => [`${k.keyword}|${k.txType}`, k])).values()]
        // Bỏ các từ khóa vừa được ghi đè ở trên
        .filter((k) => !corrections.some((c) => c.keyword === k.keyword && c.txType === k.txType));
      await reinforceCategoryRules(userId, uniqueKept);
    } catch (learnErr) {
      console.error("[Import] Không thể lưu quy tắc phân loại:", (learnErr as Error)?.message);
    }

    return { success: true, imported: transactionData.length, learnedRules };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return { success: false, imported: 0, error: message };
  }
}
