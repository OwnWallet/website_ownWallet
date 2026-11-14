import { z } from "zod";

/** Biến chuỗi rỗng / null từ FormData thành undefined để các field optional không bị lỗi validate */
const emptyToUndefined = (val: unknown) =>
  val === "" || val === null || val === undefined ? undefined : val;

export const GoalSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên mục tiêu").max(100),
  targetAmount: z.coerce.number().positive("Số tiền mục tiêu phải lớn hơn 0"),
  deadline: z.preprocess(emptyToUndefined, z.coerce.date({ error: "Hạn chót không hợp lệ" }).optional()),
  note: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
});

export const GoalContributionSchema = z.object({
  amount: z.coerce.number().positive("Số tiền phải lớn hơn 0"),
  note: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  recordedAt: z.preprocess(emptyToUndefined, z.coerce.date().default(() => new Date())),
});

export type GoalInput = z.infer<typeof GoalSchema>;
export type GoalContributionInput = z.infer<typeof GoalContributionSchema>;
