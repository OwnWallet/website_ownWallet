import { z } from "zod";

export const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
    newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
    confirmPassword: z.string().min(6, "Xác nhận mật khẩu mới"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export const UpdateProfileSchema = z.object({
  name: z.string().min(1, "Tên không được để trống").max(100),
  timezone: z.string().default("Asia/Ho_Chi_Minh"),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1, "Nhập tên danh mục").max(50),
  type: z.enum(["EXPENSE", "INCOME", "INVEST", "DEBT", "SAVINGS"] as const, {
    error: "Chọn loại danh mục",
  }),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}){1,2}$/, "Mã màu hex không hợp lệ (VD: #f97316)"),
  icon: z.string().max(10).default("📁"),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
