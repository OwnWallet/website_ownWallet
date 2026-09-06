"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { RegisterSchema } from "@/schemas/auth";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { signIn, signOut, isEmailAllowed } from "@/lib/auth";
import { AuthError } from "next-auth";

export type AuthState = {
  error?: string | Record<string, string[]>;
  success?: boolean;
} | null;

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function register(formData: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(formData);
  const parsed = RegisterSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password } = parsed.data;

  // Kiểm tra Whitelist
  if (!isEmailAllowed(email)) {
    return {
      error: {
        email: ["Email này chưa được cấp phép đăng ký (không nằm trong danh sách Whitelist)."],
      },
    };
  }

  // Kiểm tra email đã tồn tại
  const existing = await db.orm.public.User.where({ email }).first();
  if (existing) {
    return { error: { email: ["Email đã được sử dụng"] } };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Tạo user + seed default categories trong 1 transaction
  await db.transaction(async (tx: any) => {
    const user = await tx.orm.public.User.create({
      name,
      email,
      password: hashedPassword,
    });

    for (const cat of DEFAULT_CATEGORIES) {
      await tx.orm.public.Category.create({ ...cat, userId: user.id });
    }
  });

  return { success: true };
}

export async function registerAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  return register(formData);
}

export async function login(formData: FormData): Promise<AuthState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
    return { success: true };
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

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  return login(formData);
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
