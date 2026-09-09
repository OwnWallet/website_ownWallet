import { Temporal } from "temporal-polyfill";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ─── Tailwind class merger ─────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Chuyển đổi an toàn bất kỳ giá trị ngày nào (Date, Temporal.Instant, string, number) thành JavaScript Date
 * Ngăn chặn lỗi TypeError: Cannot use valueOf khi dùng Temporal.Instant với new Date()
 */
export function toDate(date: any): Date {
  if (!date) return new Date();
  if (date instanceof Date) return isNaN(date.getTime()) ? new Date() : date;
  if (typeof (date as any)?.epochMilliseconds === "number") {
    return new Date((date as any).epochMilliseconds);
  }
  if (typeof (date as any)?.toString === "function" && typeof date !== "string" && typeof date !== "number") {
    try {
      const str = (date as any).toString();
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) return parsed;
    } catch {
      // fallback
    }
  }
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Chuyển đổi Date / string / timestamp / Temporal.Instant thành Temporal.Instant cho Prisma 8 DateTime
 */
export function toInstant(date: any): Temporal.Instant {
  if (date && typeof (date as any).epochMilliseconds === "number") {
    return date as any;
  }
  return Temporal.Instant.fromEpochMilliseconds(toDate(date).getTime());
}

/**
 * Chuyển đổi đệ quy tất cả dữ liệu từ Prisma 8 (Temporal.Instant, Decimal, Date, BigInt)
 * thành các kiểu dữ liệu nguyên thủy (string ISO, number, boolean) để truyền an toàn
 * từ Server Components sang Client Components mà không bị Next.js báo lỗi serialization.
 */
export function serializeData<T = any>(data: any): T {
  if (data === null || data === undefined) return data;
  if (typeof (data as any)?.epochMilliseconds === "number") {
    return toDate(data).toISOString() as any;
  }
  if (data instanceof Date) {
    return data.toISOString() as any;
  }
  if (typeof data === "bigint") {
    return data.toString() as any;
  }
  if (typeof data === "object") {
    // Decimal detection
    if ((data as any).constructor && ((data as any).constructor.name === "Decimal" || (data as any).isDecimal || ((data as any).d && (data as any).e))) {
      return Number(data) as any;
    }
    // Temporal PlainDate/PlainDateTime/Instant check
    if (typeof (data as any).toString === "function" && (data as any).constructor && (data as any).constructor.name?.startsWith("Plain")) {
      return (data as any).toString() as any;
    }
    if (Array.isArray(data)) {
      return data.map(serializeData) as any;
    }
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      res[k] = serializeData(v);
    }
    return res as any;
  }
  return data;
}

// ─── Number & Metric formatting ────────────────────────────────

/**
 * Làm tròn số đến hàng phần trăm / số thập phân hàng trăm (tối đa 2 chữ số thập phân)
 * @example roundToHundredth(12.3456) → 12.35
 * @example roundToHundredth(10) → 10
 */
export function roundToHundredth(num: number): number {
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Format chỉ số số liệu / tỷ lệ làm tròn đến số thập phân hàng trăm (tối đa 2 chữ số thập phân)
 * @example formatMetric(12.3456) → "12,35"
 * @example formatMetric(50) → "50"
 */
export function formatMetric(num: number, maxDigits = 2): string {
  if (isNaN(num)) return "0";
  const rounded = roundToHundredth(num);
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: maxDigits,
  }).format(rounded);
}

// ─── Currency formatting ───────────────────────────────────────
const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 2,
});

/**
 * Format số thành chuỗi tiền VNĐ, làm tròn đến số thập phân hàng trăm nếu có phần thập phân
 * @example formatCurrency(3000000) → "3.000.000 ₫"
 * @example formatCurrency(100.567) → "100,57 ₫"
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0 ₫";
  return VND_FORMATTER.format(roundToHundredth(num));
}

/**
 * Format số tiền dạng compact, làm tròn đến số thập phân hàng trăm
 * @example formatCurrencyCompact(3500000) → "3,5tr ₫"
 * @example formatCurrencyCompact(1250000) → "1,25tr ₫"
 */
export function formatCurrencyCompact(amount: number): string {
  const abs = Math.abs(amount);
  const formatWithDecimals = (val: number, unit: string) => {
    const rounded = roundToHundredth(val);
    const str = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(rounded);
    return `${str}${unit} ₫`;
  };

  if (abs >= 1_000_000_000) {
    return formatWithDecimals(amount / 1_000_000_000, "tỷ");
  }
  if (abs >= 1_000_000) {
    return formatWithDecimals(amount / 1_000_000, "tr");
  }
  if (abs >= 1_000) {
    return formatWithDecimals(amount / 1_000, "k");
  }
  return `${amount} ₫`;
}

// ─── Vietnamese Currency Reader (Đọc tiền bằng chữ) ───────────
const VIETNAMESE_DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function readThreeDigits(triad: number, showLeadingZero: boolean): string {
  const h = Math.floor(triad / 100);
  const t = Math.floor((triad % 100) / 10);
  const u = triad % 10;
  const parts: string[] = [];

  if (h > 0 || showLeadingZero) {
    parts.push(`${VIETNAMESE_DIGITS[h]} trăm`);
  }

  if (t > 1) {
    parts.push(`${VIETNAMESE_DIGITS[t]} mươi`);
    if (u === 1) parts.push("mốt");
    else if (u === 4) parts.push("tư");
    else if (u === 5) parts.push("lăm");
    else if (u > 0) parts.push(VIETNAMESE_DIGITS[u]);
  } else if (t === 1) {
    parts.push("mười");
    if (u === 5) parts.push("lăm");
    else if (u > 0) parts.push(VIETNAMESE_DIGITS[u]);
  } else if (t === 0 && (h > 0 || showLeadingZero) && u > 0) {
    parts.push("lẻ");
    parts.push(VIETNAMESE_DIGITS[u]);
  } else if (t === 0 && !showLeadingZero && h === 0 && u > 0) {
    parts.push(VIETNAMESE_DIGITS[u]);
  }

  return parts.join(" ");
}

/**
 * Đọc số tiền thành chuỗi chữ tiếng Việt
 * @example readVietnameseCurrency(500000) → "Năm trăm nghìn đồng"
 * @example readVietnameseCurrency(2500000) → "Hai triệu năm trăm nghìn đồng"
 */
export function readVietnameseCurrency(amount: number): string {
  if (isNaN(amount) || amount <= 0) return "";
  const integerPart = Math.floor(amount);
  if (integerPart === 0) return "Không đồng";

  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  let num = integerPart;
  const triads: number[] = [];

  while (num > 0) {
    triads.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  const resultParts: string[] = [];
  for (let i = triads.length - 1; i >= 0; i--) {
    const triad = triads[i];
    if (triad > 0) {
      const showLeadingZero = i < triads.length - 1;
      const text = readThreeDigits(triad, showLeadingZero);
      if (text) {
        resultParts.push(`${text} ${scales[i]}`.trim());
      }
    }
  }

  const finalStr = resultParts.join(" ").trim() + " đồng";
  return finalStr.charAt(0).toUpperCase() + finalStr.slice(1);
}

// ─── Date / Time formatting ────────────────────────────────────
const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** @example formatDate(date) → "04/08/2026" */
export function formatDate(date: any): string {
  return DATE_FORMATTER.format(toDate(date));
}

/** @example formatDateTime(date) → "04/08/2026, 18:32" */
export function formatDateTime(date: any): string {
  return DATETIME_FORMATTER.format(toDate(date));
}

/** @example formatTime(date) → "18:32" */
export function formatTime(date: any): string {
  return TIME_FORMATTER.format(toDate(date));
}

/**
 * Relative time — "vừa xong", "5 phút trước", "hôm qua"
 */
export function formatRelativeTime(date: any): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay === 1) return "hôm qua";
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return formatDate(d);
}

/**
 * Trả về thông tin tiêu đề ngày đẹp tiếng Việt kèm thứ, ngày tháng và trạng thái "Hôm nay", "Hôm qua"
 */
export function formatDayHeader(date: any): { title: string; subtitle: string; isToday: boolean } {
  const d = toDate(date);
  const now = new Date();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayOfWeekNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = dayOfWeekNames[d.getDay()];
  const formattedDay = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  if (isSameDay(d, now)) {
    return { title: "Hôm nay", subtitle: `${dayName}, ${formattedDay}`, isToday: true };
  }
  if (isSameDay(d, yesterday)) {
    return { title: "Hôm qua", subtitle: `${dayName}, ${formattedDay}`, isToday: false };
  }
  return { title: dayName, subtitle: formattedDay, isToday: false };
}

// ─── Misc helpers ──────────────────────────────────────────────

/** Tính % tiến độ, làm tròn đến số thập phân hàng trăm (tối đa 2 chữ số thập phân), clamp 0–100 */
export function calcPercent(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, roundToHundredth((current / total) * 100)));
}

/** Lấy ngày đầu và cuối tháng hiện tại theo timezone người dùng */
export function getCurrentMonthRange(
  timezone = "Asia/Ho_Chi_Minh"
): { from: Date; to: Date } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month] = formatter.format(now).split("-").map(Number);

  const tzOffset = -new Date(
    `${year}-${String(month).padStart(2, "0")}-01T00:00:00`
  ).getTimezoneOffset();

  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - tzOffset * 60_000);
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59) - tzOffset * 60_000);

  return { from, to };
}

/**
 * Trả về khoảng thời gian bắt đầu và kết thúc lọc linh hoạt theo tháng (1-12 hoặc "ALL" cả năm) và năm
 */
export function getFilterDateRange(
  monthParam?: number | string | null,
  yearParam?: number | string | null,
  _timezone = "Asia/Ho_Chi_Minh"
): { from: Date; to: Date; month: number | "ALL"; year: number; label: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let year = yearParam ? Number(yearParam) : currentYear;
  if (isNaN(year) || year < 2000 || year > 2100) year = currentYear;

  let month: number | "ALL" = currentMonth;
  if (monthParam === "ALL" || monthParam === "all") {
    month = "ALL";
  } else if (monthParam !== undefined && monthParam !== null) {
    const mNum = Number(monthParam);
    if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
      month = mNum;
    }
  }

  const tzOffset = -new Date(`${year}-01-01T00:00:00`).getTimezoneOffset();

  if (month === "ALL") {
    // Toàn bộ năm
    const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0) - tzOffset * 60_000);
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - tzOffset * 60_000);
    return { from, to, month: "ALL", year, label: `Năm ${year}` };
  } else {
    // Tháng cụ thể trong năm
    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - tzOffset * 60_000);
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999) - tzOffset * 60_000);
    return { from, to, month, year, label: `Tháng ${month}/${year}` };
  }
}

/** Sleep (dùng trong seed / test) */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mask số tài khoản: chỉ hiển thị 4 số cuối (hoặc giữ nguyên nếu <= 4 ký tự)
 * @example maskAccountNumber("1234567890") → "•••• 7890"
 */
export function maskAccountNumber(acc: string | null | undefined): string {
  if (!acc) return "";
  const cleaned = String(acc).trim();
  if (cleaned.length <= 4) return cleaned;
  return `•••• ${cleaned.slice(-4)}`;
}
