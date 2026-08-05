import { z } from "zod";

export const GoalSchema = z.object({
  name: z.string().min(1, "Nhập tên mục tiêu").max(100),
  targetAmount: z.coerce.number().positive("Số tiền mục tiêu phải lớn hơn 0"),
  deadline: z.coerce.date().optional(),
  note: z.string().max(200).optional(),
});

export const GoalContributionSchema = z.object({
  amount: z.coerce.number().positive("Số tiền phải lớn hơn 0"),
  note: z.string().max(200).optional(),
  recordedAt: z.coerce.date().default(() => new Date()),
});

export type GoalInput = z.infer<typeof GoalSchema>;
export type GoalContributionInput = z.infer<typeof GoalContributionSchema>;
