/**
 * parseDocument.ts
 * Core AI logic: gửi file (PDF hoặc text từ Excel/CSV) đến Gemini,
 * nhận về mảng giao dịch đã được phân tích.
 */

import { getGeminiModel } from "@/lib/ai/gemini";
import { parseExcelToText, isExcelOrCsv, isPdf } from "@/lib/ai/excelParser";
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
}

export async function parseDocument(
  buffer: Buffer,
  filename: string,
  availableCategories: string[]
): Promise<ParseDocumentResult> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(
      "File quá lớn. Tối đa " + MAX_FILE_SIZE / 1024 / 1024 + "MB."
    );
  }

  const model = await getGeminiModel();
  const systemPrompt = buildSystemPrompt(availableCategories);

  let rawGeminiResponse: string;

  if (isPdf(filename)) {
    // ── PDF: gửi trực tiếp dạng base64 inline_data ──
    const base64 = buffer.toString("base64");
    const result = await model.generateContent([
      { text: systemPrompt },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
      { text: "Hãy trích xuất tất cả giao dịch từ tài liệu này." },
    ]);
    rawGeminiResponse = result.response.text();
  } else if (isExcelOrCsv(filename)) {
    // ── Excel/CSV: convert sang text rồi gửi ──
    const csvText = parseExcelToText(buffer, filename);
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: "Dữ liệu bảng tính:\n\n" + csvText },
    ]);
    rawGeminiResponse = result.response.text();
  } else {
    throw new Error(
      "Định dạng file không được hỗ trợ: " +
        filename +
        ". Chỉ hỗ trợ PDF, XLSX, XLS, CSV."
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

  return {
    transactions,
    totalFound: parsed.length,
    skipped,
  };
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
