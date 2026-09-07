import { z } from "zod";

export const InvestmentSchema = z.object({
  name: z.string().min(1, "Nhập tên tài sản").max(100),
  ticker: z.string().max(20).optional(),
  assetType: z.string().optional(),
  exchange: z.string().optional(),
  note: z.string().optional(),
  targetPrice: z
    .preprocess((val) => (val === "" || val === null || val === undefined ? undefined : val), z.coerce.number().positive().optional()),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0"),
  buyPrice: z.coerce.number().positive("Giá mua phải lớn hơn 0"),
  boughtAt: z.coerce.date({ error: "Chọn ngày mua" }),
});

export const UpdatePriceSchema = z.object({
  currentPrice: z.coerce.number().positive("Giá phải lớn hơn 0"),
});

export const InvestLogSchema = z.object({
  action: z.enum(["BUY", "SELL"] as const),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0"),
  price: z.coerce.number().positive("Giá phải lớn hơn 0"),
  recordedAt: z.coerce.date().default(() => new Date()),
});

export type InvestmentInput = z.infer<typeof InvestmentSchema>;
export type UpdatePriceInput = z.infer<typeof UpdatePriceSchema>;
export type InvestLogInput = z.infer<typeof InvestLogSchema>;
