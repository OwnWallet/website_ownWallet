import type { DebtDir, TxType } from "@/types";

// ─────────────────────────────────────────────────────────────────
// TAG CHUẨN DUY NHẤT dùng để đánh dấu "đã đồng bộ" trong note của Debt
// Format: [tx_id:{txId}]  — không có dấu cách sau dấu ":"
// Giao dịch (Transaction) KHÔNG bị đánh dấu nữa (tránh mutation note)
// ─────────────────────────────────────────────────────────────────
export const DEBT_SYNC_TAG_PREFIX = "[tx_id:";
export const DEBT_SYNC_TAG_SUFFIX = "]";

/** Tạo tag đồng bộ chuẩn cho một txId */
export function buildSyncTag(txId: string): string {
  return `${DEBT_SYNC_TAG_PREFIX}${txId}${DEBT_SYNC_TAG_SUFFIX}`;
}

/** Trích xuất tập hợp tất cả txId đã được gộp vào một note của Debt.
 * Hỗ trợ cả format cũ [tx_id: id] (có khoảng trắng) lẫn format mới [tx_id:id] */
export function extractSyncedTxIds(note?: string | null): Set<string> {
  const set = new Set<string>();
  if (!note) return set;
  // Khớp cả hai format: [tx_id:abc123] và [tx_id: abc123]
  const matches = note.matchAll(/\[tx_id:\s*([a-zA-Z0-9_-]+)\]/g);
  for (const m of matches) {
    if (m[1]) set.add(m[1].trim());
  }
  return set;
}

/**
 * Kiểm tra xem giao dịch này đã được đưa vào sổ nợ hay chưa.
 * Nguồn sự thật chính: note của Debt records (tag chuẩn).
 * Fallback backward-compat: tag cũ [Đã vào sổ nợ] trên Transaction.note.
 */
export function isTxAlreadySynced(
  txId: string,
  txNote: string | null | undefined,
  existingDebts: Array<{ id: string; note?: string | null }> = []
): boolean {
  // Backward compat: tag cũ trên Transaction.note
  if (txNote && txNote.includes("[Đã vào sổ nợ]")) return true;

  // Tag chuẩn trong Debt.note
  const tag = buildSyncTag(txId);
  for (const debt of existingDebts) {
    if (debt.note && debt.note.includes(tag)) {
      return true;
    }
  }
  return false;
}

/**
 * Kiểm tra xem danh mục có liên quan đến Vay / Cho vay / Nợ hay không.
 */
export function isDebtCategory(category?: { name: string; type: string } | null): boolean {
  if (!category) return false;
  if (category.type === "DEBT") return true;
  const name = category.name.toLowerCase();
  return (
    name.includes("vay") ||
    name.includes("mượn") ||
    name.includes("nợ") ||
    name.includes("tiền nợ")
  );
}

/**
 * Xác định chiều khoản nợ:
 * - OWE: Tôi nợ người khác (Đi vay / Nợ phải trả)
 * - OWED: Người khác nợ tôi (Cho vay / Nợ phải thu)
 */
export function getDebtDirection(
  category?: { name: string; type: string } | null,
  txType?: TxType
): DebtDir {
  const name = (category?.name || "").toLowerCase();

  // Cho vay / Nợ phải thu -> OWED (Người nợ tôi)
  if (
    name.includes("cho vay") ||
    name.includes("cho mượn") ||
    name.includes("nợ phải thu") ||
    name.includes("thu nợ") ||
    name.includes("đòi nợ")
  ) {
    return "OWED";
  }

  // Đi vay / Vay mượn / Nợ phải trả -> OWE (Tôi nợ người khác)
  if (
    name.includes("đi vay") ||
    name.includes("vay tiền") ||
    name.includes("nợ phải trả") ||
    name.includes("trả nợ") ||
    name.includes("mượn tiền") ||
    (name.includes("vay") && !name.includes("cho vay")) ||
    (name.includes("mượn") && !name.includes("cho mượn"))
  ) {
    return "OWE";
  }

  // Fallback theo bản chất dòng tiền giao dịch:
  // EXPENSE: Tiền xuất ra khỏi ví -> Cho vay (Người nợ mình = OWED)
  // INCOME: Tiền nhập vào ví -> Đi vay (Mình nợ người ta = OWE)
  return txType === "EXPENSE" ? "OWED" : "OWE";
}

/** Danh sách từ phổ thông KHÔNG phải tên người */
const GENERIC_NOTE_PATTERNS =
  /^(tiền ăn|ăn uống|mua sắm|hóa đơn|cà phê|xăng|xe|chuyển khoản|rút tiền|lương|thưởng|chi tiêu|sinh hoạt|điện nước|internet|thuê nhà|bảo hiểm|học phí|y tế|sức khỏe|du lịch|giải trí|ăn trưa|ăn sáng|ăn tối)$/i;

/**
 * Tách tên người sở hữu / đối tác từ note của giao dịch.
 * Ưu tiên tag có cấu trúc [Người: Tên] rồi mới dùng heuristic.
 *
 * Trả về `hasFallback: true` nếu tên được đoán theo heuristic (không chắc chắn).
 */
export function extractDebtPerson(note?: string | null): {
  person: string | null;
  cleanNote: string;
  hasFallback: boolean;
} {
  if (!note || !note.trim()) {
    return { person: null, cleanNote: "", hasFallback: false };
  }

  const trimmed = note.trim();

  // Loại bỏ tag đồng bộ khỏi note để lấy cleanNote
  const cleanedOfTag = trimmed.replace(/\[tx_id:[a-zA-Z0-9_-]+\]/g, "").trim();

  // 1. Kiểm tra tag có cấu trúc [Người: ...] hoặc [Đối tác: ...]
  const tagMatch = cleanedOfTag.match(
    /\[(?:Người|Đối tác|Người sở hữu|Chủ nợ|Con nợ):\s*([^\]]+)\]/i
  );
  if (tagMatch) {
    const person = tagMatch[1].trim();
    const cleanNote = cleanedOfTag.replace(tagMatch[0], "").trim();
    return { person, cleanNote, hasFallback: false };
  }

  // 2. Pattern tiếng Việt: "Vay của X", "Vay từ X", "Vay anh/chị X"
  const borrowMatch = cleanedOfTag.match(
    /(?:đi\s+)?vay(?:\s+(?:của|từ|bạn|anh|chị|em|chú|bác))?\s+([A-Za-zÀ-ỹ0-9\s]{2,30}?)(?:\s*[-–:,]|\s+\d+|\s+tiền|$)/i
  );
  if (borrowMatch && borrowMatch[1]?.trim()) {
    const person = borrowMatch[1].trim();
    return { person, cleanNote: cleanedOfTag, hasFallback: false };
  }

  // 3. Pattern: "Cho X vay", "Cho X mượn"
  const lendMatch = cleanedOfTag.match(/cho\s+([A-Za-zÀ-ỹ0-9\s]{2,30}?)\s+(?:vay|mượn)/i);
  if (lendMatch && lendMatch[1]?.trim()) {
    const person = lendMatch[1].trim();
    return { person, cleanNote: cleanedOfTag, hasFallback: false };
  }

  // 4. Fallback: note ngắn, không phải từ khóa chi tiêu phổ thông,
  //    không chứa số (tránh nhận "500k", "1tr" làm tên)
  //    Đây là heuristic không chắc chắn → hasFallback = true
  const hasNumber = /\d/.test(cleanedOfTag);
  if (
    !hasNumber &&
    !GENERIC_NOTE_PATTERNS.test(cleanedOfTag) &&
    cleanedOfTag.length >= 2 &&
    cleanedOfTag.length <= 30 &&
    !cleanedOfTag.includes("\n")
  ) {
    return { person: cleanedOfTag, cleanNote: cleanedOfTag, hasFallback: true };
  }

  return { person: null, cleanNote: cleanedOfTag, hasFallback: false };
}

/**
 * Đóng gói note kèm tag tên người để lưu trữ nhất quán.
 */
export function formatDebtNote(person: string, userNote?: string | null): string {
  const p = person.trim();
  const rawNote = userNote?.trim() || "";
  if (!p) return rawNote;

  if (/\[(?:Người|Đối tác):\s*[^\]]+\]/i.test(rawNote)) {
    return rawNote.replace(/\[(?:Người|Đối tác):\s*[^\]]+\]/i, `[Người: ${p}]`).trim();
  }

  return rawNote ? `[Người: ${p}] ${rawNote}` : `[Người: ${p}]`;
}
