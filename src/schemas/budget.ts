import { z } from "zod";

export const BudgetSchema = z.object({
  categoryId: z.string().cuid("Chọn danh mục"),
  limitAmount: z.coerce
    .number({ error: "Số tiền không hợp lệ" })
    .positive("Hạn mức phải lớn hơn 0"),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
});

export type BudgetInput = z.infer<typeof BudgetSchema>;
