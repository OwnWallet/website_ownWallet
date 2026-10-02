import { z } from "zod";

export const DebtSchema = z.object({
  person: z.string().min(1, "Nhập tên người").max(100),
  amount: z.coerce.number().positive("Số tiền phải lớn hơn 0"),
  direction: z.enum(["OWE", "OWED"] as const, { error: "Chọn chiều nợ" }),
  priority: z.enum(["HIGH", "NORMAL", "LOW"] as const).default("NORMAL"),
  dueDate: z
    .preprocess((val) => (val === "" || val === null || val === undefined ? undefined : val), z.coerce.date().optional()),
  note: z.string().max(1000).optional(),
});

export const DebtUpdateSchema = z.object({
  person: z.string().min(1, "Nhập tên người").max(100),
  amount: z.coerce.number().positive("Số tiền phải lớn hơn 0"),
  paidAmount: z.coerce.number().min(0, "Số tiền đã trả không được âm").optional(),
  direction: z.enum(["OWE", "OWED"] as const, { error: "Chọn chiều nợ" }),
  priority: z.enum(["HIGH", "NORMAL", "LOW"] as const).default("NORMAL"),
  dueDate: z
    .preprocess((val) => (val === "" || val === null || val === undefined ? undefined : val), z.coerce.date().optional()),
  note: z.string().max(1000).optional(),
});

export const DebtPaymentSchema = z.object({
  paidAmount: z.coerce.number().positive("Số tiền phải lớn hơn 0"),
  note: z.string().max(1000).optional(),
});

export type DebtInput = z.infer<typeof DebtSchema>;
export type DebtUpdateInput = z.infer<typeof DebtUpdateSchema>;
export type DebtPaymentInput = z.infer<typeof DebtPaymentSchema>;
