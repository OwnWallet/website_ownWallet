/**
 * parseDocument.ts
 * Core AI logic: gửi file (PDF hoặc text từ Excel/CSV) đến Gemini,
 * nhận về mảng giao dịch đã được phân tích.
 */

import { getGeminiModel } from "@/lib/ai/gemini";
import { parseExcelToText, isExcelOrCsv, isPdf } from "@/lib/ai/excelParser";
import { extractTextFromPdfBuffer } from "@/lib/ai/pdfTextExtractor";
import {
  parseTpBankPdfLocally,
  parseExcelOrCsvLocally,
} from "@/lib/ai/localStatementParser";
import { ParsedTransactionSchema, type ParsedTransaction } from "@/schemas/ai-import";

const MAX_FILE_SIZE = parseInt(
  process.env.AI_MAX_FILE_SIZE_BYTES ?? String(10 * 1024 * 1024),
  10
);

const MAX_TRANSACTIONS = parseInt(
  process.env.AI_MAX_TRANSACTIONS_PER_PARSE ?? "500",
  10
);

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt (dùng string nối thay vì template literal để tránh backtick conflict)
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(availableCategories: string[]): string {
  const catList = availableCategories.join(", ");
  const maxTx = MAX_TRANSACTIONS;

  const lines = [
    "Bạn là AI phân tích tài chính chuyên nghiệp cho ứng dụng OwnWallet.",
    "Nhiệm vụ: trích xuất TẤT CẢ giao dịch tài chính từ tài liệu được cung cấp (sao kê ngân hàng TPBank PDF, hoặc bảng Excel/CSV).",
    "",
    "## QUY TẮC BẮT BUỘC",
    "",
    "1. **Chỉ trả về JSON thuần** — không giải thích, không markdown, không code block. Chỉ mảng JSON hợp lệ.",
    "2. **Trích xuất TẤT CẢ giao dịch** — không bỏ sót. Tối đa " + maxTx + " giao dịch.",
    "3. **Ngày tháng**: Luôn chuyển sang ISO 8601 với múi giờ +07:00 (Asia/Ho_Chi_Minh).",
    '   - "05/09/2026" → "2026-09-05T00:00:00+07:00"',
    '   - "2026-09-05 14:30" → "2026-09-05T14:30:00+07:00"',
    "   - Nếu chỉ có ngày, dùng 00:00:00.",
    "4. **Phân loại INCOME/EXPENSE**:",
    '   - TPBank: "Ghi có" = INCOME, "Ghi nợ" = EXPENSE',
    '   - Excel: Cột dấu +/- hoặc từ khóa "thu"/"chi"/"nạp"/"rút"',
    "   - Số tiền luôn là số DƯƠNG (bất kể chiều giao dịch).",
    "5. **Category**: Chọn từ danh sách sau, hoặc tự đề xuất nếu không phù hợp:",
    "   [" + catList + "]",
    "6. **Confidence**: Mức độ chắc chắn từ 0 đến 1.",
    "   - 1.0: Thông tin rõ ràng đầy đủ",
    "   - 0.7-0.9: Có thể suy luận hợp lý",
    "   - < 0.7: Không chắc chắn, cần user xem lại",
    "",
    "## FORMAT OUTPUT (mảng JSON)",
    "",
    '[{"amount":500000,"type":"EXPENSE","categoryName":"An uong","note":"Mo ta goc","recordedAt":"2026-09-05T12:30:00+07:00","confidence":0.95}]',
    "",
    "## XU LY TPBANK PDF",
    "- Bo qua cac dong header, footer, tong cong — chi lay giao dich thuc te.",
    "- Cot thuong gap: Ngay GD | So tai khoan | Mo ta | Ghi no | Ghi co | So du",
    "- So tien co the co dau phay phan cach hang nghin (1,500,000) → parse thanh 1500000.",
    "",
    "## XU LY EXCEL/CSV COT TUY Y",
    "- Tu nhan dien cot ngay, cot so tien, cot mo ta tu header.",
    "- Neu khong co header ro rang, suy luan tu noi dung cot.",
    "- Linh hoat voi nhieu dinh dang ngay: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY.",
  ];

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parse function
// ─────────────────────────────────────────────────────────────────────────────

export interface ParseDocumentResult {
  transactions: ParsedTransaction[];
  totalFound: number;
  skipped: number; // Số dòng bị skip do validation fail
  modeUsed?: "local" | "ai-fallback-local" | "ai";
  fallbackReason?: string;
  detectedBank?: string;
  detectedAccountNumber?: string;
}

function tryLocalParse(
  buffer: Buffer,
  filename: string,
  availableCategories: string[]
): ParseDocumentResult | null {
  if (isPdf(filename)) {
    const res = parseTpBankPdfLocally(buffer, availableCategories);
    if (res && res.transactions.length > 0) {
      return {
        transactions: res.transactions,
        totalFound: res.totalFound,
        skipped: res.skipped,
        detectedBank: res.detectedBank,
        detectedAccountNumber: res.detectedAccountNumber,
      };
    }
    return null;
  }

  if (isExcelOrCsv(filename)) {
    const res = parseExcelOrCsvLocally(buffer, availableCategories);
    if (res && res.transactions.length > 0) {
      return {
        transactions: res.transactions,
        totalFound: res.totalFound,
        skipped: res.skipped,
      };
    }
    return null;
  }

  return null;
}

async function generateContentWithFallback(
  contentParts: any[],
  customModel?: string
): Promise<string> {
  const primaryModel = await getGeminiModel(customModel);
  const candidateFallbacks = [
    "gemini-3.7-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ].filter((m) => m !== customModel);

  try {
    const result = await primaryModel.generateContent(contentParts);
    return result.response.text();
  } catch (err: any) {
    const errMsg = err?.message || "";
    const is503 =
      errMsg.includes("503") ||
      errMsg.toLowerCase().includes("high demand") ||
      errMsg.toLowerCase().includes("unavailable");

    if (!is503) {
      if (
        errMsg.includes("429") ||
        errMsg.toLowerCase().includes("resource exhausted") ||
        errMsg.toLowerCase().includes("quota")
      ) {
        throw new Error(
          "Tài khoản Google Gemini đã đạt giới hạn yêu cầu (Lỗi 429 Quota Exceeded). Vui lòng đợi vài phút hoặc chuyển sang model khác."
        );
      }
      throw err;
    }

    console.warn(
      `[AI Import] Model ${customModel || "mặc định"} gặp lỗi 503 (High Demand). Đang tự động chuyển sang model dự phòng...`
    );

    // Thử lần lượt các fallback model
    for (const fallbackModelName of candidateFallbacks) {
      try {
        console.log(`[AI Import] Thử với model dự phòng: ${fallbackModelName}...`);
        const fallbackModel = await getGeminiModel(fallbackModelName);
        const result = await fallbackModel.generateContent(contentParts);
        const text = result.response.text();
        if (text) {
          console.log(`[AI Import] Thành công với model dự phòng: ${fallbackModelName}`);
          return text;
        }
      } catch (fallbackErr: any) {
        console.warn(
          `[AI Import] Fallback model ${fallbackModelName} thất bại:`,
          fallbackErr?.message
        );
      }
    }

    throw new Error(
      "Máy chủ Google Gemini hiện đang quá tải toàn cầu (Lỗi 503 Service Unavailable). Hệ thống đã thử các model dự phòng nhưng chưa thể kết nối. Vui lòng thử lại sau giây lát hoặc đổi API Key khác."
    );
  }
}

export async function parseDocument(
  buffer: Buffer,
  filename: string,
  availableCategories: string[],
  customModel?: string
): Promise<ParseDocumentResult> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(
      "File quá lớn. Tối đa " + MAX_FILE_SIZE / 1024 / 1024 + "MB."
    );
  }

  if (!isPdf(filename) && !isExcelOrCsv(filename)) {
    throw new Error(
      "Định dạng file không được hỗ trợ: " +
        filename +
        ". Chỉ hỗ trợ PDF, XLSX, XLS, CSV."
    );
  }

  // ── Bước 1: Thử trích xuất bằng Bộ đọc Tọa độ Bảng Sao kê nội bộ trước (chính xác 100% cột Nợ/Có/Ngày/Diễn giải) ──
  const structuredLocalResult = tryLocalParse(buffer, filename, availableCategories);

  // Nếu chọn chế độ đọc trực tiếp không cần AI: trả về ngay lập tức (< 10ms)
  if (customModel === "local-parser") {
    if (structuredLocalResult) {
      return {
        ...structuredLocalResult,
        modeUsed: "local",
      };
    }
    throw new Error(
      "File này là bản scan ảnh hoặc không có lớp văn bản bảng chuẩn để đọc trực tiếp. Vui lòng chọn một Model AI (như gemini-2.5-flash) để dùng nhận diện hình ảnh (Vision)."
    );
  }

  // Nếu là PDF Sao kê số (Techcombank / TPBank) đã bóc tách chuẩn xác 100% bằng tọa độ bảng (X, Y):
  // Khóa cứng (Lock) toàn bộ Ngày giờ, Số tiền, Loại Thu/Chi (Nợ/Có) và Diễn giải theo kết quả tọa độ bảng
  // để AI không bao giờ nhầm lẫn cột hoặc gộp sai dòng, chỉ nhờ AI gợi ý thêm danh mục nếu cần!
  if (isPdf(filename) && structuredLocalResult && structuredLocalResult.transactions.length > 0) {
    try {
      const catList = availableCategories.join(", ");
      const itemsToClassify = structuredLocalResult.transactions.map((t, idx) => ({
        idx,
        type: t.type,
        note: t.note,
        currentCategory: t.categoryName,
      }));

      const aiCatResponse = await generateContentWithFallback(
        [
          {
            text:
              "Bạn là trợ lý phân loại danh mục tài chính cho OwnWallet.\n" +
              "Danh sách danh mục hợp lệ: [" + catList + "].\n" +
              "Dưới đây là danh sách giao dịch đã được trích xuất chính xác từ sao kê ngân hàng. " +
              "Hãy giữ nguyên idx và trả về mảng JSON thuần dạng [{\"idx\":0,\"categoryName\":\"...\"}] với categoryName phù hợp nhất từ danh sách trên. Không giải thích, không markdown.",
          },
          { text: JSON.stringify(itemsToClassify) },
        ],
        customModel
      );

      const parsedCats = extractJsonFromResponse(aiCatResponse);
      if (Array.isArray(parsedCats)) {
        const catByIdx = new Map<number, string>();
        for (const item of parsedCats) {
          if (
            item &&
            typeof item === "object" &&
            typeof (item as any).idx === "number" &&
            typeof (item as any).categoryName === "string" &&
            (item as any).categoryName.trim()
          ) {
            catByIdx.set((item as any).idx, (item as any).categoryName.trim());
          }
        }

        const refinedTransactions = structuredLocalResult.transactions.map((t, idx) => {
          const aiCat = catByIdx.get(idx);
          // Nếu từ khóa nội bộ đã khớp độ tin cậy cao (0.95) thì ưu tiên giữ nguyên, chỉ dùng AI cho các dòng chung chung (0.85)
          if (t.confidence < 0.9 && aiCat) {
            return { ...t, categoryName: aiCat, confidence: 0.92 };
          }
          return t;
        });

        return {
          ...structuredLocalResult,
          transactions: refinedTransactions,
          modeUsed: "ai",
        };
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "AI đang bận";
      return {
        ...structuredLocalResult,
        modeUsed: "ai-fallback-local",
        fallbackReason: reason,
      };
    }

    return {
      ...structuredLocalResult,
      modeUsed: "local",
    };
  }

  // ── Bước 2: Dùng Gemini AI cho PDF Scan (Vision) hoặc Excel/CSV tùy ý ──
  const systemPrompt = buildSystemPrompt(availableCategories);

  try {
    let rawGeminiResponse: string;

    if (isPdf(filename)) {
      const extractedText = extractTextFromPdfBuffer(buffer);

      if (extractedText && extractedText.length > 50) {
        rawGeminiResponse = await generateContentWithFallback(
          [
            { text: systemPrompt },
            { text: "Dữ liệu sao kê văn bản trích xuất từ file PDF:\n\n" + extractedText },
            {
              text: "Hãy phân tích và trích xuất tất cả các giao dịch từ bảng sao kê trên thành JSON mảng theo đúng định dạng yêu cầu.",
            },
          ],
          customModel
        );
      } else {
        const base64 = buffer.toString("base64");
        rawGeminiResponse = await generateContentWithFallback(
          [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64,
              },
            },
            {
              text: "Hãy trích xuất tất cả giao dịch từ tất cả các trang của tài liệu này theo đúng định dạng JSON yêu cầu.",
            },
          ],
          customModel
        );
      }
    } else {
      // ── Excel/CSV: convert sang text rồi gửi ──
      const csvText = parseExcelToText(buffer, filename);
      rawGeminiResponse = await generateContentWithFallback(
        [
          { text: systemPrompt },
          { text: "Dữ liệu bảng tính:\n\n" + csvText },
        ],
        customModel
      );
    }

    // ── Parse JSON từ response ──
    const parsed = extractJsonFromResponse(rawGeminiResponse);
    if (!Array.isArray(parsed)) {
      throw new Error(
        "AI không trả về đúng định dạng JSON mảng. Vui lòng thử lại."
      );
    }

    // ── Validate từng item với Zod ──
    const transactions: ParsedTransaction[] = [];
    let skipped = 0;
    for (const item of parsed) {
      const result = ParsedTransactionSchema.safeParse(item);
      if (result.success) {
        transactions.push(result.data);
      } else {
        skipped++;
      }
    }

    if (transactions.length === 0) {
      throw new Error("AI không trích xuất được giao dịch hợp lệ nào từ tài liệu.");
    }

    return {
      transactions,
      totalFound: parsed.length,
      skipped,
      modeUsed: "ai",
    };
  } catch (aiErr: unknown) {
    const aiErrMessage =
      aiErr instanceof Error ? aiErr.message : "Không thể kết nối AI API";
    console.warn(
      "[AI Import] Gặp lỗi khi gọi AI API, đang tự động thử bóc tách bằng bộ đọc Sao kê nội bộ:",
      aiErrMessage
    );

    const localFallback = tryLocalParse(buffer, filename, availableCategories);
    if (localFallback && localFallback.transactions.length > 0) {
      console.log(
        `[AI Import] Tự động dự phòng thành công! Đã trích xuất ${localFallback.transactions.length} giao dịch bằng bộ đọc nội bộ.`
      );
      return {
        ...localFallback,
        modeUsed: "ai-fallback-local",
        fallbackReason: aiErrMessage,
      };
    }

    throw aiErr;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Trích xuất JSON từ text (Gemini đôi khi vẫn wrap markdown)
// ─────────────────────────────────────────────────────────────────────────────

function extractJsonFromResponse(text: string): unknown {
  const trimmed = text.trim();

  // Thử parse trực tiếp
  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore
  }

  // Tìm JSON array trong markdown code block (```json ... ``` hoặc ``` ... ```)
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // ignore
    }
  }

  // Tìm mảng JSON bất kỳ trong text
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // ignore
    }
  }

  throw new Error("Không tìm thấy JSON hợp lệ trong response của AI.");
}
