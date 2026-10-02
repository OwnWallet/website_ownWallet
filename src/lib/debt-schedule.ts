export interface DebtScheduleConfig {
  hasInterest?: boolean;
  rate?: number; // Lãi suất %
  rateType?: "year" | "month"; // % theo năm hay theo tháng
  isMonthly?: boolean; // Trả theo từng tháng
  months?: number; // Số tháng kỳ hạn
  method?: "annuity" | "linear"; // Trả góp đều (annuity) hay dư nợ giảm dần (linear)
  startDate?: string; // Ngày bắt đầu trả (YYYY-MM-DD)
}

export interface ParsedDebtMeta {
  schedule?: DebtScheduleConfig;
  cleanNote: string;
}

const SCHEDULE_TAG_REGEX = /\[SCHEDULE:(\{.*?\})\]/;

/**
 * Trích xuất cấu hình lịch trả nợ & lãi suất từ note của khoản nợ
 */
export function parseDebtMetadata(note?: string | null): ParsedDebtMeta {
  if (!note || !note.trim()) {
    return { cleanNote: "" };
  }

  const match = note.match(SCHEDULE_TAG_REGEX);
  if (!match) {
    return { cleanNote: note.trim() };
  }

  try {
    const jsonStr = match[1];
    const schedule = JSON.parse(jsonStr) as DebtScheduleConfig;
    const cleanNote = note.replace(SCHEDULE_TAG_REGEX, "").trim();
    return { schedule, cleanNote };
  } catch {
    return { cleanNote: note.trim() };
  }
}

/**
 * Đóng gói cấu hình lịch trả nợ vào chuỗi note
 */
export function encodeDebtMetadata(cleanNote: string, schedule?: DebtScheduleConfig): string {
  const trimmed = cleanNote.trim();
  if (!schedule || (!schedule.hasInterest && !schedule.isMonthly)) {
    return trimmed;
  }
  const tag = `[SCHEDULE:${JSON.stringify(schedule)}]`;
  return trimmed ? `${trimmed} ${tag}` : tag;
}

export interface PaymentScheduleRow {
  month: number;
  periodLabel: string;
  principal: number;
  interest: number;
  payment: number;
  balance: number;
  isPaid?: boolean;
}

export interface AmortizationResult {
  rows: PaymentScheduleRow[];
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
}

/**
 * Tính toán bảng phân bổ trả nợ (Amortization Schedule)
 */
export function calculateDebtAmortization(
  principal: number,
  ratePercent: number = 0,
  rateType: "year" | "month" = "year",
  months: number = 12,
  method: "annuity" | "linear" = "annuity",
  startDate?: Date | string | null,
  paidAmount: number = 0
): AmortizationResult {
  const safePrincipal = Math.max(0, principal);
  const safeMonths = Math.max(1, Math.min(360, months));
  const annualRate = rateType === "month" ? ratePercent * 12 : ratePercent;
  const monthlyRate = annualRate > 0 ? annualRate / 100 / 12 : 0;

  const rows: PaymentScheduleRow[] = [];
  let currentBalance = safePrincipal;
  let accumulatedPaid = 0;

  const baseDate = startDate ? new Date(startDate) : new Date();

  if (method === "annuity") {
    // Trả góp đều (EMI / Annuity)
    const monthlyPayment =
      monthlyRate === 0
        ? safePrincipal / safeMonths
        : (safePrincipal * monthlyRate * Math.pow(1 + monthlyRate, safeMonths)) /
          (Math.pow(1 + monthlyRate, safeMonths) - 1);

    for (let m = 1; m <= safeMonths; m++) {
      const rowDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + m, 1);
      const periodLabel = `Tháng ${m} (${rowDate.getMonth() + 1}/${rowDate.getFullYear()})`;

      const interest = currentBalance * monthlyRate;
      const principalPart = monthlyPayment - interest;
      currentBalance = Math.max(0, currentBalance - principalPart);

      accumulatedPaid += monthlyPayment;
      const isPaid = paidAmount >= accumulatedPaid - 1000; // Sai số nhỏ chấp nhận được

      rows.push({
        month: m,
        periodLabel,
        principal: principalPart,
        interest,
        payment: monthlyPayment,
        balance: currentBalance,
        isPaid,
      });
    }
  } else {
    // Dư nợ giảm dần (Linear)
    const fixedPrincipal = safePrincipal / safeMonths;

    for (let m = 1; m <= safeMonths; m++) {
      const rowDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + m, 1);
      const periodLabel = `Tháng ${m} (${rowDate.getMonth() + 1}/${rowDate.getFullYear()})`;

      const interest = currentBalance * monthlyRate;
      const payment = fixedPrincipal + interest;
      currentBalance = Math.max(0, currentBalance - fixedPrincipal);

      accumulatedPaid += payment;
      const isPaid = paidAmount >= accumulatedPaid - 1000;

      rows.push({
        month: m,
        periodLabel,
        principal: fixedPrincipal,
        interest,
        payment,
        balance: currentBalance,
        isPaid,
      });
    }
  }

  const totalPayment = rows.reduce((s, r) => s + r.payment, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const monthlyPayment = rows[0]?.payment ?? 0;

  return {
    rows,
    monthlyPayment,
    totalPayment,
    totalInterest,
  };
}
