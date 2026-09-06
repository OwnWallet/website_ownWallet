import { GoogleGenerativeAI } from "@google/generative-ai";

// Singleton Gemini client
let _client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
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

export function getGeminiModel(customModel?: string) {
  const model = customModel ?? process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  return getGeminiClient().getGenerativeModel({ model });
}
