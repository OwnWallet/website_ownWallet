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
  debtPerson: z.string().max(100).optional().nullable(),
  // z.coerce.boolean() biến chuỗi "false" thành true → parse tường minh
  syncToDebt: z
    .preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean())
    .optional(),
  // Gộp nợ là tùy chọn: mặc định tạo khoản nợ mới
  debtMode: z.preprocess(
    (v) => (v === "MERGE" ? "MERGE" : "NEW"),
    z.enum(["NEW", "MERGE"] as const)
  ).optional(),
  targetDebtId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || v === "NONE" ? undefined : String(v)),
    z.string().optional()
  ),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;
