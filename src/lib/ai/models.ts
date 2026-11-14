/**
 * Danh sách model Gemini dùng chung cho Server & Client (không import SDK / DB ở đây).
 *
 * Đo thực tế (11/2026) với tác vụ phân loại 30 giao dịch:
 *  - gemini-3.5-flash (thinking minimal): ~4s
 *  - gemini-3.1-flash-lite: ~2.5s
 *  - gemini-3.8-flash: > 110s (vượt giới hạn 60s của route → import thất bại)
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

/** Chuỗi model dự phòng khi model chính quá chậm / quá tải / không khả dụng */
export const FALLBACK_GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

/** Giá trị đặc biệt: đọc file trực tiếp không cần AI */
export const LOCAL_PARSER_MODEL = "local-parser";

export const SUGGESTED_GEMINI_MODELS: { id: string; label: string }[] = [
  { id: "gemini-3.5-flash", label: "gemini-3.5-flash (Khuyên dùng — nhanh, chính xác)" },
  { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite (Siêu nhanh, tiết kiệm)" },
  { id: "gemini-3.8-flash", label: "gemini-3.8-flash (Rất chậm — dễ quá thời gian chờ)" },
];

/** Ngưỡng cảnh báo model phản hồi chậm khi kiểm tra kết nối */
export const SLOW_MODEL_WARNING_MS = 15_000;
