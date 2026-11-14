import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";
import { getSystemSetting } from "@/lib/system-settings";

import { DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODELS } from "@/lib/ai/models";

export { DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODELS };

/** Thời gian chờ tối đa cho MỘT lần gọi model (route có maxDuration = 60s) */
export const AI_CALL_TIMEOUT_MS = Number(process.env.AI_CALL_TIMEOUT_MS ?? 25_000);

// Singleton Gemini client
let _client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY chưa được cấu hình. Vui lòng vào Cài đặt để thêm API Key.");
    }
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

export function resetGeminiClient(newApiKey?: string) {
  if (newApiKey) {
    process.env.GEMINI_API_KEY = newApiKey;
  }
  _client = null;
}

async function ensureApiKeyLoaded() {
  // Tự động lấy API Key từ DB nếu biến môi trường chưa có (hữu ích cho Serverless/Vercel)
  if (!process.env.GEMINI_API_KEY) {
    const key = await getSystemSetting("GEMINI_API_KEY");
    if (key) {
      process.env.GEMINI_API_KEY = key;
      resetGeminiClient(key);
    }
  }
}

export async function getConfiguredModelName(): Promise<string> {
  return (
    process.env.GEMINI_MODEL?.trim() ||
    (await getSystemSetting("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)).trim() ||
    DEFAULT_GEMINI_MODEL
  );
}

/**
 * Gemini 3.x mặc định "suy nghĩ" trước khi trả lời → rất chậm cho tác vụ trích xuất/phân loại.
 * Giảm mức suy nghĩ với các model hỗ trợ ("minimal" không được gemini-3.8-flash hỗ trợ).
 */
export function buildGenerationConfig(
  modelName: string,
  opts: { json?: boolean; withThinking?: boolean } = {}
): GenerationConfig {
  const config: Record<string, unknown> = {
    temperature: 0.1,
    maxOutputTokens: 16384,
  };
  if (opts.json) config.responseMimeType = "application/json";
  if (opts.withThinking !== false && /^gemini-3\.(5-flash|1-flash-lite)/.test(modelName)) {
    config.thinkingConfig = { thinkingLevel: "minimal" };
  }
  return config as GenerationConfig;
}

export async function getGeminiModel(customModel?: string, opts: { json?: boolean; withThinking?: boolean } = {}) {
  await ensureApiKeyLoaded();
  const modelName = customModel ?? (await getConfiguredModelName());
  return getGeminiClient().getGenerativeModel({
    model: modelName,
    generationConfig: buildGenerationConfig(modelName, opts),
  });
}

export type AiErrorKind = "auth" | "timeout" | "overloaded" | "quota" | "not_found" | "bad_config" | "other";

export function classifyAiError(err: unknown): AiErrorKind {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  const name = err instanceof Error ? err.name : "";
  if (msg.includes("api_key_invalid") || msg.includes("api key not valid") || msg.includes("[401") || msg.includes("[403") || msg.includes("permission_denied"))
    return "auth";
  if (name === "AbortError" || msg.includes("aborted") || msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (msg.includes("429") || msg.includes("resource exhausted") || msg.includes("quota")) return "quota";
  if (msg.includes("503") || msg.includes("500") || msg.includes("high demand") || msg.includes("unavailable") || msg.includes("overloaded"))
    return "overloaded";
  if (msg.includes("404") || msg.includes("not found")) return "not_found";
  if (msg.includes("thinking") || msg.includes("[400")) return "bad_config";
  return "other";
}

export function describeAiError(kind: AiErrorKind, modelName?: string): string {
  const m = modelName ? `"${modelName}"` : "AI";
  switch (kind) {
    case "auth":
      return "API Key Gemini không hợp lệ hoặc không có quyền. Vui lòng kiểm tra lại trong Cài đặt.";
    case "timeout":
      return `Model ${m} phản hồi quá chậm (quá ${Math.round(AI_CALL_TIMEOUT_MS / 1000)} giây). Hãy chọn gemini-3.5-flash trong Cài đặt.`;
    case "quota":
      return "Tài khoản Google Gemini đã đạt giới hạn yêu cầu (429). Vui lòng đợi vài phút.";
    case "overloaded":
      return `Máy chủ Google cho model ${m} đang quá tải (503). Vui lòng thử lại sau.`;
    case "not_found":
      return `Model ${m} không tồn tại hoặc API Key chưa có quyền truy cập.`;
    case "bad_config":
      return `Model ${m} không hỗ trợ cấu hình yêu cầu.`;
    default:
      return "Không thể kết nối tới Google Gemini.";
  }
}

export interface AiCallResult {
  text: string;
  modelUsed: string;
  attempts: { model: string; ms: number; error?: AiErrorKind }[];
}

/**
 * Gọi Gemini với timeout cho từng lần gọi và tự động chuyển model dự phòng khi model chính
 * quá chậm / quá tải / hết quota / không tồn tại. Lỗi API Key thì dừng ngay (thử model khác vô ích).
 */
export async function generateWithFallback(
  contentParts: any[],
  opts: { preferredModel?: string; json?: boolean; deadlineMs?: number } = {}
): Promise<AiCallResult> {
  await ensureApiKeyLoaded();
  const preferred = opts.preferredModel || (await getConfiguredModelName());
  const chain = [...new Set([preferred, ...FALLBACK_GEMINI_MODELS])];
  const deadline = Date.now() + (opts.deadlineMs ?? 50_000);
  const attempts: AiCallResult["attempts"] = [];
  let lastErr: unknown = null;
  let lastKind: AiErrorKind = "other";

  for (const modelName of chain) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;

    for (const withThinking of [true, false]) {
      const t0 = Date.now();
      try {
        const model = getGeminiClient().getGenerativeModel(
          { model: modelName, generationConfig: buildGenerationConfig(modelName, { json: opts.json, withThinking }) },
          { timeout: Math.min(AI_CALL_TIMEOUT_MS, remaining) }
        );
        const result = await model.generateContent(contentParts);
        const text = result.response.text();
        attempts.push({ model: modelName, ms: Date.now() - t0 });
        if (attempts.length > 1) {
          console.info(`[Import] Dùng model dự phòng ${modelName} sau ${attempts.length - 1} lần thất bại`);
        }
        return { text, modelUsed: modelName, attempts };
      } catch (err) {
        lastErr = err;
        lastKind = classifyAiError(err);
        attempts.push({ model: modelName, ms: Date.now() - t0, error: lastKind });
        console.warn(`[Import] Model ${modelName} lỗi (${lastKind}) sau ${Date.now() - t0}ms`);
        if (lastKind === "auth") throw new Error(describeAiError("auth"));
        // Cấu hình thinking không được hỗ trợ → thử lại cùng model không kèm thinkingConfig
        if (lastKind === "bad_config" && withThinking) continue;
        break;
      }
    }
  }

  const err = new Error(describeAiError(lastKind, preferred));
  (err as any).cause = lastErr;
  (err as any).attempts = attempts;
  throw err;
}
