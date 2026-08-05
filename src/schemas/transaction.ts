import { z } from "zod";

export const TransactionSchema = z.object({
  amount: z.coerce
    .number({ error: "Số tiền không hợp lệ" })
    .positive("Số tiền phải lớn hơn 0"),
  type: z.enum(["INCOME", "EXPENSE"] as const, { error: "Chọn loại giao dịch" }),
  categoryId: z.string().cuid("Chọn danh mục"),
  note: z.string().max(200, "Ghi chú tối đa 200 ký tự").optional(),
  recordedAt: z.coerce.date({ error: "Chọn thời điểm giao dịch" }),
  goalId: z.string().cuid().optional(),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;
