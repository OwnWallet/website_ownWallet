"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { resetGeminiClient } from "@/lib/ai/gemini";
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

export async function getAiConfig() {
  await getUserId();
  const apiKey = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 10);

  let maskedKey = "";
  if (apiKey) {
    if (apiKey.length > 12) {
      maskedKey = `${apiKey.slice(0, 6)}••••••••${apiKey.slice(-4)}`;
    } else {
      maskedKey = "••••••••";
    }
  }

  return {
    isConfigured,
    maskedKey,
    model,
  };
}

export async function updateAiApiKey(formData: FormData) {
  await getUserId();
  const rawApiKey = (formData.get("apiKey") as string)?.trim() || "";
  const rawModel = ((formData.get("model") as string)?.trim()) || "gemini-3.6-flash";

  if (!rawApiKey) {
    return { error: "API Key không được để trống" };
  }

  // Chống Environment Variable Injection / Parameter Pollution
  const SAFE_API_KEY_REGEX = /^[A-Za-z0-9_\-\.]{10,256}$/;
  if (!SAFE_API_KEY_REGEX.test(rawApiKey)) {
    return { error: "API Key chứa ký tự không hợp lệ hoặc độ dài không đúng định dạng." };
  }

  const SAFE_MODEL_REGEX = /^[a-zA-Z0-9\.\-_]{3,50}$/;
  if (!SAFE_MODEL_REGEX.test(rawModel)) {
    return { error: "Tên model không hợp lệ." };
  }

  const apiKey = rawApiKey;
  const model = rawModel;

  try {
    const envPath = path.join(process.cwd(), ".env.local");
    let content = "";
    try {
      content = await fs.readFile(envPath, "utf-8");
    } catch {
      content = "";
    }

    const keyRegex = /^GEMINI_API_KEY=.*$/m;
    if (keyRegex.test(content)) {
      content = content.replace(keyRegex, `GEMINI_API_KEY="${apiKey}"`);
    } else {
      content += `\nGEMINI_API_KEY="${apiKey}"\n`;
    }

    const modelRegex = /^GEMINI_MODEL=.*$/m;
    if (modelRegex.test(content)) {
      content = content.replace(modelRegex, `GEMINI_MODEL="${model}"`);
    } else {
      content += `\nGEMINI_MODEL="${model}"\n`;
    }

    await fs.writeFile(envPath, content, "utf-8");

    // Update in-memory runtime
    process.env.GEMINI_API_KEY = apiKey;
    process.env.GEMINI_MODEL = model;
    resetGeminiClient(apiKey);

    revalidatePath("/settings");
    revalidatePath("/import");

    return { success: true };
  } catch (err: any) {
    console.error("Failed to update AI API key:", err);
    return { error: "Lỗi lưu cấu hình: " + (err?.message || "Không thể ghi file cấu hình") };
  }
}

export async function testAiApiKey(apiKeyToTest?: string) {
  await getUserId();
  const key = apiKeyToTest?.trim() || process.env.GEMINI_API_KEY;
  if (!key) {
    return { success: false, error: "Chưa nhập API Key để kiểm tra." };
  }

  try {
    const ai = new GoogleGenerativeAI(key);
    const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const model = ai.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Ping. Trả lời đúng một từ: PONG");
    const text = result.response.text();
    if (text) {
      return { success: true, message: `Kết nối thành công với ${modelName}!` };
    }
    return { success: true, message: "Kết nối thành công!" };
  } catch (err: any) {
    console.error("Test Gemini API Key failed:", err);
    let msg = err?.message || "Không thể kết nối tới Google Gemini";
    if (msg.includes("API_KEY_INVALID")) {
      msg = "API Key không hợp lệ. Vui lòng kiểm tra lại trên Google AI Studio.";
    } else if (msg.includes("404")) {
      msg = "Model không tồn tại hoặc đã bị ngừng hỗ trợ.";
    }
    return { success: false, error: msg };
  }
}
