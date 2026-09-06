import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Schema cho 1 giao dịch AI phân tích ra
// ─────────────────────────────────────────────────────────────────────────────

export const DuplicateInfoSchema = z.object({
  isDuplicate: z.boolean(),
  type: z.enum(["EXACT", "POTENTIAL"]),
  reason: z.string(),
  matchedTx: z.object({
    id: z.string(),
    amount: z.number(),
    recordedAt: z.string(),
    note: z.string().nullable().optional(),
    categoryName: z.string().optional(),
  }),
});

export type DuplicateInfo = z.infer<typeof DuplicateInfoSchema>;

export const ParsedTransactionSchema = z.object({
  amount: z.number().positive("Số tiền phải > 0"),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryName: z.string().min(1, "Category không được trống"),
  note: z.string().optional().default(""),
  recordedAt: z
    .string()
    .refine(
      (val) => !isNaN(Date.parse(val)),
      "recordedAt không phải định dạng datetime hợp lệ"
    ),
  confidence: z.number().min(0).max(1).default(1),
  duplicateInfo: DuplicateInfoSchema.optional(),
});

export type ParsedTransaction = z.infer<typeof ParsedTransactionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Schema cho request confirm import (sau khi user đã review)
// ─────────────────────────────────────────────────────────────────────────────

export const ConfirmImportSchema = z.object({
  walletId: z.string().optional().nullable(),
  transactions: z
    .array(
      z.object({
        amount: z.number().positive(),
        type: z.enum(["INCOME", "EXPENSE"]),
        categoryName: z.string().min(1),
        note: z.string().optional().default(""),
        recordedAt: z.string(),
      })
    )
    .min(1, "Phải có ít nhất 1 giao dịch"),
});

export type ConfirmImportPayload = z.infer<typeof ConfirmImportSchema>;
