import { z } from "zod";

export const TransactionSchema = z.object({
  amount: z.coerce
    .number({ error: "Số tiền không hợp lệ" })
    .positive("Số tiền phải lớn hơn 0"),
  type: z.enum(["INCOME", "EXPENSE"] as const, { error: "Chọn loại giao dịch" }),
  categoryId: z.string().min(1, "Chọn danh mục"),
  note: z.string().max(200, "Ghi chú tối đa 200 ký tự").optional().nullable(),
  description: z.string().max(200, "Ghi chú tối đa 200 ký tự").optional().nullable(),
  recordedAt: z.coerce.date({ error: "Chọn thời điểm giao dịch" }),
  goalId: z.string().optional().nullable(),
  walletId: z.string().optional().nullable(),
  evidenceUrl: z.string().optional().nullable(),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;
