/**
 * Quy tắc phân loại tự học (pure logic, dùng được ở cả server & test).
 *
 * Ý tưởng: khi người dùng sửa danh mục cho một giao dịch import (VD "HIGHLANDS COFFEE Q1" → Ăn uống),
 * ta trích "từ khóa người bán" (HIGHLANDS COFFEE) và ghi nhớ. Lần import sau, giao dịch có mô tả
 * chứa từ khóa đó được gán danh mục ngay — không cần AI.
 */

export interface CategoryRule {
  id: string;
  keyword: string; // Đã chuẩn hóa: chữ HOA, không dấu, cách nhau 1 khoảng trắng
  txType: "INCOME" | "EXPENSE";
  categoryId: string;
  hits: number;
}

/** Từ nhiễu thường gặp trong diễn giải sao kê ngân hàng VN — không mang thông tin người bán */
const NOISE_WORDS = new Set([
  "TT", "THANH", "TOAN", "CK", "CHUYEN", "KHOAN", "TIEN", "QR", "POS", "VISA", "MASTERCARD", "NAPAS",
  "IBFT", "FT", "MB", "TU", "DEN", "CHO", "TAI", "TRA", "NOP", "RUT", "GD", "GIAO", "DICH", "SO", "TK",
  "NGAY", "REF", "TRACE", "ID", "MA", "VND", "DONG", "THE", "DEBIT", "CREDIT",
  "PAYMENT", "PAY", "TRANSFER", "TO", "FROM", "AT", "VN", "VIETNAM", "HCM", "HN", "HANOI", "TPHCM",
  "Q1", "Q2", "Q3", "Q4", "Q5", "Q7", "Q10", "CN", "PGD", "ORDER", "DON", "HANG", "AND", "THE",
]);

/** Bỏ dấu tiếng Việt, viết HOA, chỉ giữ chữ / số / khoảng trắng */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Trích từ khóa người bán từ diễn giải giao dịch.
 * Lấy tối đa 2 từ có nghĩa đầu tiên (bỏ số, mã giao dịch, từ nhiễu). Trả null nếu không có từ khóa đủ tin cậy.
 * @example extractMerchantKey("TT QR HIGHLANDS COFFEE Q1 FT26321") → "HIGHLANDS COFFEE"
 * @example extractMerchantKey("GRAB*TRIP 123456") → "GRAB TRIP"
 */
export function extractMerchantKey(note?: string | null): string | null {
  if (!note) return null;
  // Bỏ các tag hệ thống như [Người: ...], [skip_debt_sync]
  const withoutTags = note.replace(/\[[^\]]*\]/g, " ");
  const all = normalizeText(withoutTags).split(" ");
  const tokens = all.filter(
    (t, i) =>
      t.length >= 3 && // bỏ từ quá ngắn
      !/\d/.test(t) && // bỏ mã giao dịch, số tiền, số tài khoản
      !NOISE_WORDS.has(t) &&
      // "LUC 10 30" (lúc + giờ) là nhiễu, nhưng "DIEN LUC" là tên người bán
      !(t === "LUC" && /\d/.test(all[i + 1] ?? ""))
  );
  if (tokens.length === 0) return null;
  const key = tokens.slice(0, 2).join(" ");
  return key.length >= 4 ? key : null;
}

/** Tìm quy tắc phù hợp nhất (từ khóa dài nhất, cùng loại thu/chi) cho một diễn giải */
export function findMatchingRule<T extends Pick<CategoryRule, "keyword" | "txType" | "hits">>(
  note: string | null | undefined,
  txType: "INCOME" | "EXPENSE",
  rules: T[]
): T | null {
  if (!note || rules.length === 0) return null;
  const haystack = ` ${normalizeText(note)} `;
  let best: T | null = null;
  for (const rule of rules) {
    if (rule.txType !== txType) continue;
    if (!haystack.includes(` ${rule.keyword} `)) continue;
    if (
      !best ||
      rule.keyword.length > best.keyword.length ||
      (rule.keyword.length === best.keyword.length && rule.hits > best.hits)
    ) {
      best = rule;
    }
  }
  return best;
}

export interface RuleApplicable {
  note?: string;
  type: "INCOME" | "EXPENSE";
  categoryName: string;
  confidence: number;
  categorySource?: "rule" | "ai" | "local";
  ruleKeyword?: string;
  suggestedCategoryName?: string;
}

export type RuleAnnotations = Pick<RuleApplicable, "categorySource" | "ruleKeyword" | "suggestedCategoryName">;

/**
 * Áp dụng quy tắc đã học lên danh sách giao dịch vừa trích xuất.
 * categoryNameById: chỉ các danh mục còn tồn tại (quy tắc trỏ tới danh mục đã xóa sẽ bị bỏ qua).
 */
export function applyCategoryRules<T extends RuleApplicable>(
  transactions: T[],
  rules: CategoryRule[],
  categoryNameById: Map<string, string>
): { transactions: (T & RuleAnnotations)[]; appliedCount: number } {
  let appliedCount = 0;
  const result = transactions.map((t): T & RuleAnnotations => {
    const rule = findMatchingRule(t.note, t.type, rules);
    const ruleCategory = rule ? categoryNameById.get(rule.categoryId) : undefined;
    if (rule && ruleCategory) {
      appliedCount++;
      return {
        ...t,
        categoryName: ruleCategory,
        confidence: 0.99,
        categorySource: "rule" as const,
        ruleKeyword: rule.keyword,
        suggestedCategoryName: ruleCategory,
      };
    }
    return { ...t, suggestedCategoryName: t.categoryName };
  });
  return { transactions: result, appliedCount };
}

export interface LearnInput {
  note?: string;
  type: "INCOME" | "EXPENSE";
  categoryName: string;
  suggestedCategoryName?: string;
}

/**
 * Chọn ra các giao dịch người dùng đã SỬA danh mục (khác gợi ý) để học thành quy tắc.
 * Mỗi (từ khóa, loại) chỉ lấy lựa chọn cuối cùng trong lần import.
 */
export function collectCorrections(rows: LearnInput[]): { keyword: string; txType: "INCOME" | "EXPENSE"; categoryName: string }[] {
  const byKey = new Map<string, { keyword: string; txType: "INCOME" | "EXPENSE"; categoryName: string }>();
  for (const r of rows) {
    if (r.suggestedCategoryName === undefined) continue; // payload cũ không có gợi ý → không học
    if (!r.categoryName || r.categoryName.trim().toLowerCase() === r.suggestedCategoryName.trim().toLowerCase()) continue;
    const keyword = extractMerchantKey(r.note);
    if (!keyword) continue;
    byKey.set(`${keyword}|${r.type}`, { keyword, txType: r.type, categoryName: r.categoryName });
  }
  return [...byKey.values()];
}
