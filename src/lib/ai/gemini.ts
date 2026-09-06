import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemSetting } from "@/lib/system-settings";

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

export async function getGeminiModel(customModel?: string) {
  // Tự động lấy API Key từ DB nếu biến môi trường chưa có (hữu ích cho Serverless/Vercel)
  if (!process.env.GEMINI_API_KEY) {
    const key = await getSystemSetting("GEMINI_API_KEY");
    if (key) {
      process.env.GEMINI_API_KEY = key;
      resetGeminiClient(key);
    }
  }

  const modelName =
    customModel ?? process.env.GEMINI_MODEL ?? (await getSystemSetting("GEMINI_MODEL", "gemini-3.6-flash"));
  return getGeminiClient().getGenerativeModel({ model: modelName });
}
