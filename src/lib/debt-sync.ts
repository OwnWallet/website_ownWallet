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
  // Bỏ qua nếu giao dịch đã được đánh dấu không đồng bộ sổ nợ
  if (txNote && txNote.includes(DEBT_SKIP_SYNC_TAG)) return true;

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

export const DEBT_SKIP_SYNC_TAG = "[skip_debt_sync]";

/**
 * Xác định chiều khoản nợ dựa trên Danh mục, Loại giao dịch (INCOME/EXPENSE) và Ghi chú:
 * - OWE: Tôi nợ người khác (Đi vay / Nợ phải trả / Tôi trả nợ)
 * - OWED: Người khác nợ tôi (Cho vay / Nợ phải thu / Người khác trả nợ tôi)
 */
export function getDebtDirection(
  category?: { name: string; type: string } | null,
  txType?: TxType,
  note?: string | null
): DebtDir {
  const catName = (category?.name || "").toLowerCase();
  const text = `${catName} ${(note || "").toLowerCase()}`;

  // 1. Phân biệt theo Loại dòng tiền (TxType)
  if (txType === "INCOME") {
    // Tiền vào ví:
    // - Nếu có từ khóa "thu nợ", "người khác trả", "được trả nợ", "trả nợ", "đòi nợ", "hoàn nợ", hoặc danh mục "Nợ phải thu":
    //   -> Đối tác đang trả nợ cho mình -> Khoản nợ gốc thuộc "Người khác nợ tôi" (OWED)
    if (
      text.includes("thu nợ") ||
      text.includes("người khác trả") ||
      text.includes("được trả") ||
      text.includes("đòi nợ") ||
      text.includes("hoàn nợ") ||
      text.includes("trả nợ") ||
      catName.includes("nợ phải thu")
    ) {
      return "OWED";
    }

    // - Nếu có từ khóa "đi vay", "vay tiền", "mượn tiền", "giải ngân", hoặc danh mục "Nợ phải trả":
    //   -> Mình đi vay thêm tiền vào ví -> "Tôi nợ người khác" (OWE)
    if (
      text.includes("đi vay") ||
      text.includes("vay tiền") ||
      text.includes("mượn tiền") ||
      text.includes("giải ngân") ||
      catName.includes("nợ phải trả")
    ) {
      return "OWE";
    }

    return "OWED"; // Mặc định dòng tiền vào sổ nợ là thu nợ về (OWED)
  }

  // 2. Tiền ra khỏi ví (EXPENSE):
  // - Nếu có từ khóa "cho vay", "cho mượn", hoặc danh mục "Nợ phải thu":
  //   -> Xuất tiền cho người khác vay -> "Người khác nợ tôi" (OWED)
  if (
    text.includes("cho vay") ||
    text.includes("cho mượn") ||
    catName.includes("nợ phải thu")
  ) {
    return "OWED";
  }

  // - Nếu có từ khóa "trả nợ", "thanh toán nợ", "tất toán", "nợ phải trả", hoặc danh mục "Nợ phải trả":
  //   -> Xuất tiền trả nợ cho chủ nợ -> "Tôi nợ người khác" (OWE)
  if (
    text.includes("trả nợ") ||
    text.includes("thanh toán nợ") ||
    text.includes("tất toán") ||
    catName.includes("nợ phải trả")
  ) {
    return "OWE";
  }

  // Fallback mặc định theo bản chất dòng tiền
  return txType === "EXPENSE" ? "OWED" : "OWE";
}

export interface DebtTxAnalysis {
  direction: DebtDir;
  action: "PAYMENT" | "TOPUP" | "CREATE";
  isRepayment: boolean;
  person: string | null;
  cleanNote: string;
  personIsFallback: boolean;
}

/**
 * Phân tích toàn diện giao dịch: Chiều nợ (OWE/OWED) và Bản chất hành vi (PAYMENT vs TOPUP/CREATE)
 */
export function analyzeDebtTransaction(
  category?: { name: string; type: string } | null,
  txType?: TxType,
  note?: string | null
): DebtTxAnalysis {
  const direction = getDebtDirection(category, txType, note);
  const { person, cleanNote, hasFallback } = extractDebtPerson(note);
  const catName = (category?.name || "").toLowerCase();
  const text = `${catName} ${(note || "").toLowerCase()}`;

  let isRepayment = false;
  if (direction === "OWED") {
    // Người khác nợ tôi:
    // Tiền vào ví (INCOME) hoặc có từ khóa trả nợ/thu nợ -> Là đối tác trả nợ (PAYMENT)
    if (
      txType === "INCOME" ||
      text.includes("thu nợ") ||
      text.includes("trả nợ") ||
      text.includes("được trả")
    ) {
      isRepayment = true;
    }
  } else {
    // Tôi nợ người khác (OWE):
    // Tiền ra ví (EXPENSE) hoặc có từ khóa trả nợ/thanh toán -> Là tôi trả nợ (PAYMENT)
    if (
      txType === "EXPENSE" ||
      text.includes("trả nợ") ||
      text.includes("thanh toán nợ") ||
      text.includes("tất toán")
    ) {
      isRepayment = true;
    }
  }

  const action = isRepayment ? "PAYMENT" : "TOPUP";

  return {
    direction,
    action,
    isRepayment,
    person,
    cleanNote,
    personIsFallback: hasFallback,
  };
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
