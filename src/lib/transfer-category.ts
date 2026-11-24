import { TRANSFER_CATEGORY_NAME } from "@/lib/finance";

/**
 * Danh mục dùng cho mọi giao dịch chuyển khoản nội bộ (chuyển ví, thanh toán thẻ tín dụng, import).
 *
 * Bảng Category có ràng buộc duy nhất (userId, name) nên chỉ tồn tại MỘT danh mục tên này cho
 * mỗi người dùng — dùng chung cho cả chiều ra (EXPENSE) và chiều vào (INCOME). Việc loại trừ
 * khỏi tổng thu/chi dựa trên tiền tố [TRANSFER] trong ghi chú, không dựa vào loại danh mục.
 *
 * @param tx client trong db.transaction(...) hoặc chính `db`
 */
export async function getOrCreateTransferCategory(tx: any, userId: string, type: "EXPENSE" | "INCOME") {
  const existing = await tx.orm.public.Category.where({ userId, name: TRANSFER_CATEGORY_NAME }).first();
  if (existing) return existing;
  return tx.orm.public.Category.create({
    name: TRANSFER_CATEGORY_NAME,
    type,
    color: "#64748b",
    icon: "🔁",
    userId,
  });
}
