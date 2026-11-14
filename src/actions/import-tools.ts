"use server";

import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSetting } from "@/lib/system-settings";
import { buildGenerationConfig, classifyAiError, describeAiError, getConfiguredModelName } from "@/lib/ai/gemini";
import { LOCAL_PARSER_MODEL, SLOW_MODEL_WARNING_MS } from "@/lib/ai/models";
import { getCategoryRules, deleteCategoryRule } from "@/lib/category-rules-db";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// ─────────────────────────────────────────────────────────────────
// Quy tắc phân loại tự học
// ─────────────────────────────────────────────────────────────────

export interface CategoryRuleView {
  id: string;
  keyword: string;
  txType: "INCOME" | "EXPENSE";
  hits: number;
  categoryName: string | null; // null = danh mục đã bị xóa (quy tắc không còn hiệu lực)
  categoryIcon: string | null;
}

export async function listCategoryRules(): Promise<CategoryRuleView[]> {
  const userId = await getUserId();
  const [rules, categories] = await Promise.all([
    getCategoryRules(userId),
    db.orm.public.Category.select("id", "name", "icon").where({ userId }).all(),
  ]);
  const catById = new Map(categories.map((c: any) => [c.id, c]));
  return rules.map((r) => {
    const cat: any = catById.get(r.categoryId);
    return {
      id: r.id,
      keyword: r.keyword,
      txType: r.txType,
      hits: r.hits,
      categoryName: cat?.name ?? null,
      categoryIcon: cat?.icon ?? null,
    };
  });
}

export async function removeCategoryRule(id: string) {
  const userId = await getUserId();
  const ok = await deleteCategoryRule(userId, id);
  revalidatePath("/settings");
  return ok ? { success: true } : { error: "Không tìm thấy quy tắc" };
}

// ─────────────────────────────────────────────────────────────────
// Trạng thái AI (health check) cho trang Import
// ─────────────────────────────────────────────────────────────────

export interface AiStatus {
  state: "ready" | "slow" | "error" | "unconfigured" | "local";
  model: string;
  latencyMs?: number;
  message: string;
  checkedAt: string;
}

const STATUS_TTL_OK_MS = 5 * 60_000;
const STATUS_TTL_ERROR_MS = 60_000;
const PING_TIMEOUT_MS = 20_000;
const statusCache = new Map<string, { at: number; status: AiStatus }>();

export async function getAiStatus(requestedModel?: string, force = false): Promise<AiStatus> {
  await getUserId();
  const now = new Date().toISOString();

  if (requestedModel === LOCAL_PARSER_MODEL) {
    return { state: "local", model: LOCAL_PARSER_MODEL, message: "Đọc trực tiếp — không cần AI", checkedAt: now };
  }

  const model = (requestedModel?.trim() || (await getConfiguredModelName())).trim();
  if (!/^[a-zA-Z0-9.\-_]{3,60}$/.test(model)) {
    return { state: "error", model, message: "Tên model không hợp lệ", checkedAt: now };
  }

  const apiKey = (await getSystemSetting("GEMINI_API_KEY", process.env.GEMINI_API_KEY || "")).trim();
  if (!apiKey) {
    return {
      state: "unconfigured",
      model,
      message: "Chưa cấu hình API Key — vào Cài đặt để thêm, hoặc dùng chế độ Đọc trực tiếp",
      checkedAt: now,
    };
  }

  const cached = statusCache.get(model);
  if (!force && cached) {
    const ttl = cached.status.state === "ready" || cached.status.state === "slow" ? STATUS_TTL_OK_MS : STATUS_TTL_ERROR_MS;
    if (Date.now() - cached.at < ttl) return cached.status;
  }

  const t0 = Date.now();
  let status: AiStatus;
  try {
    const m = new GoogleGenerativeAI(apiKey).getGenerativeModel(
      { model, generationConfig: buildGenerationConfig(model) },
      { timeout: PING_TIMEOUT_MS }
    );
    const res = await m.generateContent("Ping. Trả lời đúng một từ: PONG");
    res.response.text();
    const latencyMs = Date.now() - t0;
    const sec = (latencyMs / 1000).toFixed(1);
    status =
      latencyMs > SLOW_MODEL_WARNING_MS
        ? { state: "slow", model, latencyMs, message: `AI phản hồi chậm (${sec}s) — import có thể lâu hoặc tự chuyển model dự phòng`, checkedAt: now }
        : { state: "ready", model, latencyMs, message: `AI sẵn sàng · ${sec}s`, checkedAt: now };
  } catch (err) {
    const kind = classifyAiError(err);
    status = {
      state: kind === "timeout" ? "slow" : "error",
      model,
      latencyMs: Date.now() - t0,
      message:
        kind === "timeout"
          ? `AI không phản hồi trong ${PING_TIMEOUT_MS / 1000}s — import sẽ tự chuyển sang model dự phòng`
          : describeAiError(kind, model),
      checkedAt: now,
    };
  }

  statusCache.set(model, { at: Date.now(), status });
  return status;
}
