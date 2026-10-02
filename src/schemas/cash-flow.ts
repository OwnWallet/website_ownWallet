import { z } from "zod";

export const CashFlowSourceTypeEnum = z.enum([
  "SALARY",
  "INVESTMENT_DIVIDEND",
  "RENTAL",
  "INTEREST",
  "BUSINESS",
  "OTHER",
] as const);

export const CashFlowFrequencyEnum = z.enum([
  "MONTHLY",
  "BIWEEKLY",
  "WEEKLY",
  "QUARTERLY",
  "YEARLY",
  "ONE_TIME",
] as const);

export const CashFlowSourceSchema = z.object({
  name: z.string().min(1, "Nhập tên nguồn dòng tiền").max(120),
  amount: z.coerce.number().positive("Số tiền dự kiến phải lớn hơn 0"),
  type: CashFlowSourceTypeEnum.default("SALARY"),
  frequency: CashFlowFrequencyEnum.default("MONTHLY"),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
  nextExpectedDate: z.coerce.date({
    message: "Vui lòng chọn ngày dự kiến tiếp theo",
  }),
  isActive: z.preprocess((val) => val === "true" || val === true || val === "1" || val === 1, z.boolean()).default(true),
  walletId: z.preprocess((val) => (val === "" || val === null || val === undefined ? null : String(val)), z.string().nullable().optional()),
  categoryId: z.preprocess((val) => (val === "" || val === null || val === undefined ? null : String(val)), z.string().nullable().optional()),
  investmentId: z.preprocess((val) => (val === "" || val === null || val === undefined ? null : String(val)), z.string().nullable().optional()),
  note: z.string().max(500).optional().nullable(),
});

export const CollectCashFlowSchema = z.object({
  sourceId: z.string().min(1),
  actualAmount: z.coerce.number().positive("Số tiền thực nhận phải lớn hơn 0"),
  walletId: z.string().min(1, "Vui lòng chọn ví nhận tiền"),
  receivedDate: z.coerce.date().default(() => new Date()),
  note: z.string().max(200).optional(),
});

export type CashFlowSourceInput = z.infer<typeof CashFlowSourceSchema>;
export type CollectCashFlowInput = z.infer<typeof CollectCashFlowSchema>;
