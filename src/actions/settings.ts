"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  ChangePasswordSchema,
  UpdateProfileSchema,
  CreateCategorySchema,
} from "@/schemas/settings";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function changePassword(formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = ChangePasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) return { error: "Không tìm thấy người dùng" };

  const isOldMatch = await bcrypt.compare(parsed.data.oldPassword, user.password);
  if (!isOldMatch) {
    return { error: { oldPassword: ["Mật khẩu hiện tại không chính xác"] } };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.orm.public.User.where({ id: userId }).update({
    password: newHash,
  });

  return { success: true };
}

export async function updateProfile(formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = UpdateProfileSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await db.orm.public.User.where({ id: userId }).update({
    name: parsed.data.name,
    timezone: parsed.data.timezone,
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createCategory(formData: FormData) {
  const userId = await getUserId();
  const raw = Object.fromEntries(formData);
  const parsed = CreateCategorySchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Check duplicate name for user
  const existing = await db.orm.public.Category
    .where({ userId, name: parsed.data.name })
    .first();

  if (existing) {
    return { error: { name: ["Tên danh mục này đã tồn tại"] } };
  }

  await db.orm.public.Category.create({
    name: parsed.data.name,
    type: parsed.data.type,
    color: parsed.data.color,
    icon: parsed.data.icon || "📁",
    isDefault: false,
    userId,
  });

  revalidatePath("/settings");
  revalidatePath("/transactions/new");
  revalidatePath("/transactions");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const userId = await getUserId();

  const category = await db.orm.public.Category.where({ id, userId }).first();
  if (!category) return { error: "Không tìm thấy danh mục" };

  const txCount = await db.orm.public.Transaction.where({ categoryId: id, userId }).all();
  if (txCount.length > 0) {
    return {
      error: `Không thể xóa danh mục đang được sử dụng trong ${txCount.length} giao dịch.`,
    };
  }

  await db.orm.public.Category.where({ id, userId }).delete();

  revalidatePath("/settings");
  revalidatePath("/transactions/new");
  revalidatePath("/transactions");
  return { success: true };
}
