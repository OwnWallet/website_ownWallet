"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { RegisterSchema } from "@/schemas/auth";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { signIn, signOut } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function register(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = RegisterSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password } = parsed.data;

  // Kiểm tra email đã tồn tại
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: { email: ["Email đã được sử dụng"] } };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Tạo user + seed default categories trong 1 transaction
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, password: hashedPassword },
    });

    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({ ...cat, userId: user.id })),
    });
  });

  return { success: true };
}

export async function login(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin":
          return { error: "Email hoặc mật khẩu không đúng" };
        default:
          return { error: "Đã có lỗi xảy ra. Thử lại sau" };
      }
    }
    throw err; // Re-throw để Next.js xử lý redirect
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
