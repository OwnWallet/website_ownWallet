/**
 * Tiền tệ chính xác — mọi phép cộng/chia số tiền đi qua đơn vị "xu" (1/100) bằng số nguyên
 * để tránh sai số dấu phẩy động (VD 0.1 + 0.2 = 0.30000000000000004) và không làm tròn mất tiền.
 *
 * Quy ước của ứng dụng: số tiền lưu tối đa 2 chữ số thập phân.
 */

/** Số tiền (number | chuỗi Decimal từ DB) → số nguyên xu. Chuỗi được đọc chính xác, không qua float. */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const m = value.trim().match(/^([+-])?(\d*)(?:\.(\d*))?$/);
    if (m) {
      const sign = m[1] === "-" ? -1 : 1;
      const int = m[2] || "0";
      const frac = (m[3] || "").padEnd(2, "0");
      if (frac.length <= 2 || /^0*$/.test(frac.slice(2))) {
        return sign * (Number(int) * 100 + Number(frac.slice(0, 2)));
      }
    }
    value = Number(value);
  }
  if (!Number.isFinite(value)) return 0;
  // Khử nhiễu biểu diễn nhị phân (12.34 * 100 = 1233.9999999999998) — giá trị đầu vào có ≤ 2 chữ số thập phân.
  // Làm tròn theo trị tuyệt đối để số âm và số dương đối xứng (Math.round(-1234.5) = -1234).
  const cents = Math.round(Math.abs(value) * 100);
  return value < 0 ? -cents : cents;
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Cộng chính xác nhiều số tiền. */
export function sumMoney(values: Iterable<number | string | null | undefined>): number {
  let total = 0;
  for (const v of values) total += toCents(v);
  return fromCents(total);
}

/** a + b chính xác. */
export function addMoney(a: number | string, b: number | string): number {
  return fromCents(toCents(a) + toCents(b));
}

/** a − b chính xác. */
export function subMoney(a: number | string, b: number | string): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Chia một số tiền thành n phần bằng nhau đến từng xu, tổng các phần luôn đúng bằng số ban đầu.
 * Phần lẻ không chia hết (tính bằng xu) được dồn vào kỳ cuối.
 * @example splitMoney(100, 3) → [33.33, 33.33, 33.34]
 */
export function splitMoney(total: number | string, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const cents = toCents(total);
  const base = Math.trunc(cents / n);
  const out = Array.from({ length: n }, () => base);
  out[n - 1] = cents - base * (n - 1);
  return out.map(fromCents);
}

/** Số chữ số tối đa của một số tiền viết liền không dấu phân cách (tới 9.999 tỷ). */
const MAX_PLAIN_DIGITS = 13;

export interface ParsedAmount {
  value: number;
  /** Có dấu âm, ngoặc đơn (1.000) hoặc hậu tố DR/Nợ */
  negative: boolean;
  /** Có hậu tố CR / "Có" (ghi có) — thường gặp trên sao kê thẻ tín dụng */
  credit: boolean;
}

/**
 * Đọc chuỗi số tiền với dấu phân cách bất kỳ, giữ nguyên phần thập phân:
 *   "1.234.567" → 1234567, "1,234,567.89" → 1234567.89, "1.234.567,89" → 1234567.89,
 *   "100,5" → 100.5, "(250.000)" → 250000 (negative), "1.500.000 CR" → 1500000 (credit), "12.345 VND".
 * Dấu phân cách cuối cùng theo sau bởi 1–2 chữ số là dấu thập phân; theo sau bởi đúng 3 chữ số là phân cách hàng nghìn.
 * Trả về null nếu không phải số tiền hợp lệ.
 */
export function parseAmountString(raw: string): ParsedAmount | null {
  let s = String(raw ?? "").trim();
  if (!s) return null;

  let negative = false;
  let credit = false;

  s = s.replace(/\s*(?:VND|VNĐ|đ|₫)\s*$/i, "").replace(/^(?:VND|VNĐ|₫)\s*/i, "").trim();
  // Hậu tố ghi có / ghi nợ của sao kê thẻ: "1.500.000 CR", "250.000DR"
  const suffix = s.match(/(?:\s+|(?<=\d))(CR|DR)\.?$/i);
  if (suffix) {
    if (suffix[1].toUpperCase() === "CR") credit = true;
    else negative = true;
    s = s.slice(0, suffix.index).trim();
  }
  s = s.replace(/\s*(?:VND|VNĐ|đ|₫)\s*$/i, "").trim();
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (/^[+-]/.test(s)) {
    if (s[0] === "-") negative = true;
    s = s.slice(1).trim();
  }
  if (/-$/.test(s)) {
    negative = true;
    s = s.slice(0, -1).trim();
  }
  s = s.replace(/\s+/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  // Dãy số liền dài (mã bút toán / số tham chiếu như "26246040431935") không phải số tiền.
  if (/^\d+$/.test(s) && s.length > MAX_PLAIN_DIGITS) return null;

  let intPart = s;
  let fracPart = "";
  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (lastSep >= 0) {
    const sep = s[lastSep];
    const otherSep = sep === "." ? "," : ".";
    const before = s.slice(0, lastSep);
    const after = s.slice(lastSep + 1);
    const sameSepCount = s.split(sep).length - 1;
    if (sameSepCount === 1) {
      if (before.includes(otherSep)) {
        // Dạng trộn "1.234,56" / "1,234.56": dấu cuối luôn là dấu thập phân
        intPart = before;
        fracPart = after;
      } else if (after.length === 1 || after.length === 2) {
        // Chỉ có 1 dấu, theo sau 1–2 chữ số: "100,5", "1234.56"
        intPart = before;
        fracPart = after;
      }
      // Đúng 3 chữ số phía sau ("1.234") → phân cách hàng nghìn
    }
  }
  // Phần nguyên: các nhóm phân cách hàng nghìn phải đúng 3 chữ số
  const groups = intPart.split(/[.,]/);
  if (groups.length > 1 && (groups[0].length < 1 || groups[0].length > 3 || groups.slice(1).some((g) => g.length !== 3))) {
    return null;
  }
  if (fracPart && !/^\d{1,2}$/.test(fracPart)) return null;

  const digits = groups.join("");
  const value = Number(`${digits}${fracPart ? "." + fracPart : ""}`);
  if (!Number.isFinite(value)) return null;
  return { value, negative, credit };
}

/** Hiển thị số trong ô nhập: "1234567.5" → "1.234.567,5" (giữ nguyên phần thập phân, tối đa 2 chữ số). */
export function formatAmountInput(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  const cents = Math.abs(toCents(value));
  const int = Math.trunc(cents / 100);
  const frac = cents % 100;
  const intStr = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (frac === 0) return intStr;
  const fracStr = String(frac).padStart(2, "0").replace(/0$/, "");
  return `${intStr},${fracStr}`;
}
