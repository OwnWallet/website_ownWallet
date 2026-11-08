"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getGeminiModel } from "@/lib/ai/gemini";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export interface AiFinancialReportInput {
  periodName: string;
  currentIncome: number;
  currentExpense: number;
  lastIncome: number;
  lastExpense: number;
  closingBalance: number;
  topCategories: { name: string; value: number }[];
}

export interface AiFinancialAdvice {
  summary: string;
  highlights: string[];
  warnings: string[];
  actionableTips: string[];
  source: "gemini" | "smart-engine";
}

function buildFallbackAdvice(input: AiFinancialReportInput): AiFinancialAdvice {
  const {
    periodName,
    currentIncome,
    currentExpense,
    lastIncome,
    lastExpense,
    closingBalance,
    topCategories,
  } = input;

  const net = currentIncome - currentExpense;
  const savingsRate =
    currentIncome > 0 ? Math.round(((currentIncome - currentExpense) / currentIncome) * 100) : 0;
  const expDiffPct =
    lastExpense > 0 ? Math.round(((currentExpense - lastExpense) / lastExpense) * 100) : null;
  const incDiffPct =
    lastIncome > 0 ? Math.round(((currentIncome - lastIncome) / lastIncome) * 100) : null;

  const highlights: string[] = [];
  const warnings: string[] = [];
  const actionableTips: string[] = [];

  if (net > 0) {
    highlights.push(
      `Dòng tiền dương +${formatCurrency(net)} trong ${periodName} (Tỷ lệ tiết kiệm đạt ${savingsRate}%).`
    );
  } else if (net < 0) {
    warnings.push(
      `Thâm hụt dòng tiền −${formatCurrency(Math.abs(net))} trong ${periodName} (Chi vượt thu).`
    );
  }

  if (incDiffPct !== null && incDiffPct > 5) {
    highlights.push(`Thu nhập tăng trưởng +${incDiffPct}% so với kỳ trước.`);
  } else if (incDiffPct !== null && incDiffPct < -10) {
    warnings.push(`Thu nhập giảm ${Math.abs(incDiffPct)}% so với kỳ trước.`);
  }

  if (expDiffPct !== null && expDiffPct > 15) {
    warnings.push(
      `Chi tiêu tăng +${expDiffPct}% so với kỳ trước (${formatCurrency(lastExpense)} → ${formatCurrency(currentExpense)}).`
    );
  } else if (expDiffPct !== null && expDiffPct < -5) {
    highlights.push(`Kiểm soát chi tiêu tốt: giảm ${Math.abs(expDiffPct)}% so với kỳ trước.`);
  }

  if (topCategories.length > 0 && currentExpense > 0) {
    const top1 = topCategories[0];
    const top1Share = Math.round((top1.value / currentExpense) * 100);
    if (top1Share >= 40) {
      warnings.push(
        `Danh mục "${top1.name}" chiếm tới ${top1Share}% tổng chi tiêu (${formatCurrency(top1.value)}).`
      );
      actionableTips.push(
        `Thiết lập hạn mức ngân sách tại mục Ngân sách cho danh mục "${top1.name}" giảm 10–15% ở kỳ tới.`
      );
    } else {
      highlights.push(
        `Cơ cấu chi tiêu khá phân tán; danh mục lớn nhất là "${top1.name}" (${top1Share}% tổng chi).`
      );
    }
  }

  if (savingsRate < 20 && currentIncome > 0) {
    actionableTips.push(
      `Áp dụng quy tắc 50/30/20: trích tự động tối thiểu 20% thu nhập (${formatCurrency(Math.round(currentIncome * 0.2))}) vào Mục tiêu Tiết kiệm ngay khi nhận lương.`
    );
  } else if (savingsRate >= 20) {
    actionableTips.push(
      `Duy trì tỷ lệ tiết kiệm ${savingsRate}% và phân bổ phần thặng dư (${formatCurrency(Math.max(0, net))}) vào danh mục Đầu tư hoặc Quỹ dự phòng.`
    );
  }

  actionableTips.push(
    `Số dư lũy kế hiện đạt ${formatCurrency(closingBalance)}. Hãy rà soát các hóa đơn định kỳ tại mục Dòng tiền để tối ưu chi phí cố định.`
  );

  return {
    summary:
      net >= 0
        ? `Tài chính ${periodName} đang ở trạng thái tích cực với thặng dư +${formatCurrency(net)} (tiết kiệm ${savingsRate}%).`
        : `Cần chú ý kiểm soát chi tiêu trong ${periodName} do đang bội chi ${formatCurrency(Math.abs(net))}.`,
    highlights:
      highlights.length > 0
        ? highlights
        : [`Đã ghi nhận tổng thu ${formatCurrency(currentIncome)} và tổng chi ${formatCurrency(currentExpense)}.`],
    warnings,
    actionableTips,
    source: "smart-engine",
  };
}

export async function generateAiFinancialReport(
  input: AiFinancialReportInput
): Promise<{ success: boolean; advice: AiFinancialAdvice }> {
  await getUserId();

  try {
    const model = await getGeminiModel();
    const topCatText =
      input.topCategories
        .slice(0, 5)
        .map((c) => `${c.name}: ${formatCurrency(c.value)}`)
        .join(", ") || "Chưa có chi tiêu";

    const prompt = `Bạn là Chuyên gia Cố vấn Tài chính Cá nhân (CFP). Hãy phân tích số liệu báo cáo tài chính kỳ "${input.periodName}" của người dùng Việt Nam sau đây và trả về JSON thuần (không bọc markdown):
- Thu nhập kỳ này: ${formatCurrency(input.currentIncome)} (Kỳ trước: ${formatCurrency(input.lastIncome)})
- Chi tiêu kỳ này: ${formatCurrency(input.currentExpense)} (Kỳ trước: ${formatCurrency(input.lastExpense)})
- Số dư lũy kế cuối kỳ: ${formatCurrency(input.closingBalance)}
- Top danh mục chi tiêu lớn nhất: ${topCatText}

Trả về đúng cấu trúc JSON:
{
  "summary": "Nhận xét tổng quan ngắn gọn 1-2 câu có số liệu cụ thể",
  "highlights": ["Điểm sáng tích cực 1", "Điểm sáng 2"],
  "warnings": ["Cảnh báo rủi ro / lãng phí 1 (nếu có)"],
  "actionableTips": ["Hành động cụ thể 1", "Hành động cụ thể 2", "Hành động cụ thể 3"]
}`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    if (parsed && typeof parsed.summary === "string") {
      return {
        success: true,
        advice: {
          summary: parsed.summary,
          highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
          warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
          actionableTips: Array.isArray(parsed.actionableTips) ? parsed.actionableTips : [],
          source: "gemini",
        },
      };
    }
  } catch {
    // Fallback sang Smart Financial Engine nếu chưa cấu hình Gemini API Key hoặc vượt quota
  }

  return {
    success: true,
    advice: buildFallbackAdvice(input),
  };
}

/**
 * Phòng chống CSV / Formula Injection (DDE injection trong Excel/Sheets):
 * Nếu ô bắt đầu bằng =, +, -, @, \t, \r thì chèn thêm dấu nháy đơn ' để ngăn Excel coi đó là công thức tính toán.
 */
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function exportTransactionsCSV() {
  const userId = await getUserId();

  const transactions = await db.orm.public.Transaction
    .where((t) => t.userId.eq(userId))
    .include("category", (cat) => cat)
    .orderBy((t) => t.recordedAt.desc())
    .all();

  const headers = ["ID", "Thời gian", "Loại", "Danh mục", "Số tiền (VND)", "Ghi chú"];
  const rows = transactions.map((t: any) => [
    escapeCsvCell(t.id),
    escapeCsvCell(formatDateTime(t.recordedAt)),
    escapeCsvCell(t.type === "INCOME" ? "Thu nhập" : "Chi tiêu"),
    escapeCsvCell(t.category?.name || ""),
    Number(t.amount),
    escapeCsvCell(t.note || ""),
  ]);

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  return {
    success: true,
    csv: csvContent,
    filename: `ownwallet-giao-dich-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}
