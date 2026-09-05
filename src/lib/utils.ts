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

// ─── Currency formatting ───────────────────────────────────────
const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

/**
 * Format số thành chuỗi tiền VNĐ
 * @example formatCurrency(3000000) → "3.000.000 ₫"
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0 ₫";
  return VND_FORMATTER.format(num);
}

/**
 * Format số tiền dạng compact
 * @example formatCurrencyCompact(3500000) → "3,5tr ₫"
 */
export function formatCurrencyCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}tỷ ₫`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}tr ₫`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}k ₫`;
  }
  return `${amount} ₫`;
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

// ─── Misc helpers ──────────────────────────────────────────────

/** Tính % tiến độ, clamp 0–100 */
export function calcPercent(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
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

/** Sleep (dùng trong seed / test) */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
