import { fromCents, splitMoney, toCents } from "./money";

/**
 * Thẻ tín dụng — logic thuần (không truy cập DB) để dễ test.
 *
 * Quy ước số dư: ví CREDIT dùng chung công thức currentBalance với các ví khác
 * (balance + thu − chi ± chuyển khoản). Chi tiêu bằng thẻ làm currentBalance âm,
 * vì vậy dư nợ = max(0, −currentBalance).
 *
 * Mọi mốc ngày (chốt sao kê, đến hạn) được tính theo lịch Việt Nam (UTC+7).
 */

export type WalletKind = "BANK" | "CASH" | "CREDIT";

export const WALLET_KIND_EMOJI: Record<WalletKind, string> = {
  BANK: "🏦",
  CASH: "💵",
  CREDIT: "💳",
};

export const WALLET_KIND_LABEL: Record<WalletKind, string> = {
  BANK: "Ngân hàng",
  CASH: "Ví tiền mặt",
  CREDIT: "Thẻ tín dụng",
};

/** Khoảng cách mặc định (ngày) từ ngày chốt sao kê đến hạn thanh toán khi chưa cấu hình. */
export const DEFAULT_GRACE_DAYS = 15;

interface WalletLike {
  type?: string | null;
  bankName?: string | null;
  name?: string | null;
}

/** Loại ví: ưu tiên cột `type`, giữ nguyên heuristic cũ cho ví tiền mặt tạo trước khi có cột này. */
export function getWalletKind(w: WalletLike): WalletKind {
  if (w.type === "CREDIT") return "CREDIT";
  if (w.type === "CASH") return "CASH";
  const bank = (w.bankName || "").toLowerCase();
  const name = (w.name || "").toLowerCase();
  if (w.bankName === "CASH" || bank.includes("tiền mặt") || name.includes("tiền mặt")) return "CASH";
  return "BANK";
}

export function isCreditWallet(w: WalletLike): boolean {
  return getWalletKind(w) === "CREDIT";
}

/** Dư nợ thẻ (luôn >= 0) từ số dư hiện tại của ví thẻ. */
export function getCreditDebt(currentBalance: number | string): number {
  return fromCents(Math.max(0, -toCents(currentBalance)));
}

/** % hạn mức đã sử dụng (0 – 100+). */
export function getCreditUtilization(debt: number, limit: number | null | undefined): number {
  const l = Number(limit || 0);
  if (l <= 0) return 0;
  return (Math.max(0, debt) / l) * 100;
}

export function getUtilizationLevel(pct: number): "low" | "medium" | "high" {
  if (pct < 30) return "low";
  if (pct < 70) return "medium";
  return "high";
}

// ─── Lịch theo giờ Việt Nam ───────────────────────────────────────────────

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface YMD {
  y: number;
  m: number; // 1-12
  d: number;
}

function vnParts(date: Date): YMD {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addMonths(y: number, m: number, n: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** Ngày trong tháng, kẹp về ngày cuối tháng (VD: ngày 31 của tháng 2 → 28/29). */
function clampDay(y: number, m: number, day: number): number {
  return Math.min(Math.max(1, Math.floor(day)), daysInMonth(y, m));
}

/** 00:00 giờ Việt Nam của ngày y-m-d. */
function vnMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d) - VN_OFFSET_MS);
}

function ymdIndex(p: YMD): number {
  return Date.UTC(p.y, p.m - 1, p.d) / DAY_MS;
}

/** Ngày chốt sao kê của tháng (y, m). */
function statementDateOf(y: number, m: number, statementDay: number): YMD {
  return { y, m, d: clampDay(y, m, statementDay) };
}

/** Ngày đến hạn ứng với kỳ sao kê chốt ngày `stmt`. */
function dueDateOf(stmt: YMD, statementDay: number, paymentDueDay: number | null | undefined): YMD {
  if (!paymentDueDay) {
    const d = new Date(Date.UTC(stmt.y, stmt.m - 1, stmt.d) + DEFAULT_GRACE_DAYS * DAY_MS);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  // Ngày đến hạn > ngày chốt → cùng tháng; ngược lại → tháng sau.
  // So sánh sau khi kẹp về cuối tháng: chốt 29 / hạn 30 trong tháng 2 đều thành ngày 28 → phải dời sang tháng sau,
  // nếu không hạn thanh toán trùng ngày chốt (0 ngày ân hạn).
  if (paymentDueDay > statementDay) {
    const sameMonthDay = clampDay(stmt.y, stmt.m, paymentDueDay);
    if (sameMonthDay > stmt.d) return { y: stmt.y, m: stmt.m, d: sameMonthDay };
  }
  const target = addMonths(stmt.y, stmt.m, 1);
  return { y: target.y, m: target.m, d: clampDay(target.y, target.m, paymentDueDay) };
}

export interface StatementCycle {
  /** Ngày chốt của kỳ sao kê gần nhất đã đóng (00:00 VN). */
  lastStatementDate: Date;
  /** Đầu kỳ sao kê gần nhất (ngày sau kỳ chốt trước đó, 00:00 VN). */
  periodStart: Date;
  /** Mốc kết thúc kỳ sao kê gần nhất (exclusive) = 00:00 VN ngày sau ngày chốt. */
  periodEnd: Date;
  /** Ngày chốt sao kê kế tiếp. */
  nextStatementDate: Date;
  /** Hạn thanh toán của kỳ sao kê gần nhất. */
  dueDate: Date;
  /** Số ngày còn lại tới hạn thanh toán (âm nếu đã quá hạn). */
  daysUntilDue: number;
  /** Số ngày còn lại tới ngày chốt sao kê kế tiếp. */
  daysUntilNextStatement: number;
}

/**
 * Xác định kỳ sao kê gần nhất đã chốt và hạn thanh toán tương ứng.
 * Kỳ sao kê bao gồm cả ngày chốt; kỳ chỉ được coi là "đã chốt" sau khi hết ngày chốt.
 */
export function getStatementCycle(
  statementDay: number | null | undefined,
  paymentDueDay: number | null | undefined,
  now: Date = new Date()
): StatementCycle {
  const sd = statementDay && statementDay > 0 ? Math.min(31, statementDay) : 31;
  const today = vnParts(now);

  const thisMonthStmt = statementDateOf(today.y, today.m, sd);
  const lastYM = today.d > thisMonthStmt.d ? { y: today.y, m: today.m } : addMonths(today.y, today.m, -1);
  const last = statementDateOf(lastYM.y, lastYM.m, sd);
  const prevYM = addMonths(lastYM.y, lastYM.m, -1);
  const prev = statementDateOf(prevYM.y, prevYM.m, sd);
  const nextYM = addMonths(lastYM.y, lastYM.m, 1);
  const next = statementDateOf(nextYM.y, nextYM.m, sd);
  const due = dueDateOf(last, sd, paymentDueDay);

  const todayIdx = ymdIndex(today);
  return {
    lastStatementDate: vnMidnight(last.y, last.m, last.d),
    periodStart: new Date(vnMidnight(prev.y, prev.m, prev.d).getTime() + DAY_MS),
    periodEnd: new Date(vnMidnight(last.y, last.m, last.d).getTime() + DAY_MS),
    nextStatementDate: vnMidnight(next.y, next.m, next.d),
    dueDate: vnMidnight(due.y, due.m, due.d),
    daysUntilDue: ymdIndex(due) - todayIdx,
    daysUntilNextStatement: ymdIndex(next) - todayIdx,
  };
}

// ─── Trả góp ──────────────────────────────────────────────────────────────

export interface InstallmentLike {
  principal: number;
  months: number;
  feeAmount: number;
  startDate: Date | string;
}

/**
 * Lịch trả từng kỳ (gốc + phí) chính xác đến từng xu; phần lẻ không chia hết dồn vào kỳ cuối,
 * tổng các kỳ luôn đúng bằng gốc + phí.
 */
export function getInstallmentSchedule(inst: Pick<InstallmentLike, "principal" | "months" | "feeAmount">): number[] {
  const months = Math.max(1, Math.floor(inst.months || 1));
  return splitMoney(fromCents(toCents(inst.principal) + toCents(inst.feeAmount)), months);
}

/** Số tiền mỗi kỳ thông thường (các kỳ trước kỳ cuối). */
export function getInstallmentMonthlyAmount(inst: Pick<InstallmentLike, "principal" | "months" | "feeAmount">): number {
  return getInstallmentSchedule(inst)[0];
}

/** Tổng của `count` kỳ đầu tiên (tính bằng xu). */
function scheduleCentsUpTo(schedule: number[], count: number): number {
  let total = 0;
  for (let i = 0; i < Math.min(count, schedule.length); i++) total += toCents(schedule[i]);
  return total;
}

/**
 * Số kỳ trả góp đã được đưa vào sao kê tính tới ngày chốt `statementDate`.
 * Kỳ đầu tiên rơi vào lần chốt sao kê đầu tiên kể từ ngày bắt đầu (tính cả ngày chốt).
 */
export function getInstallmentDueCount(
  inst: Pick<InstallmentLike, "months" | "startDate">,
  statementDay: number | null | undefined,
  statementDate: Date
): number {
  const sd = statementDay && statementDay > 0 ? Math.min(31, statementDay) : 31;
  const start = vnParts(new Date(inst.startDate));
  const startStmt = statementDateOf(start.y, start.m, sd);
  const firstYM = start.d <= startStmt.d ? { y: start.y, m: start.m } : addMonths(start.y, start.m, 1);
  const at = vnParts(statementDate);
  const diff = (at.y * 12 + at.m) - (firstYM.y * 12 + firstYM.m);
  const atStmt = statementDateOf(at.y, at.m, sd);
  // statementDate có thể không đúng ngày chốt; chỉ tính tháng `at` nếu đã tới ngày chốt.
  const count = at.d >= atStmt.d ? diff + 1 : diff;
  return Math.max(0, Math.min(Math.floor(inst.months), count));
}

export interface InstallmentProgress {
  monthlyAmount: number;
  /** Số tiền kỳ cuối (có thể khác các kỳ trước do phần lẻ) */
  lastAmount: number;
  paidMonths: number;
  remainingMonths: number;
  remainingAmount: number;
  totalAmount: number;
  isCompleted: boolean;
}

export function getInstallmentProgress(
  inst: InstallmentLike,
  statementDay: number | null | undefined,
  now: Date = new Date()
): InstallmentProgress {
  const cycle = getStatementCycle(statementDay, null, now);
  const months = Math.max(1, Math.floor(inst.months));
  const schedule = getInstallmentSchedule(inst);
  const totalCents = scheduleCentsUpTo(schedule, months);
  const totalAmount = fromCents(totalCents);
  const paidMonths = getInstallmentDueCount(inst, statementDay, cycle.lastStatementDate);
  const remainingMonths = months - paidMonths;
  const remainingAmount = fromCents(totalCents - scheduleCentsUpTo(schedule, paidMonths));
  return {
    monthlyAmount: schedule[0],
    lastAmount: schedule[months - 1],
    paidMonths,
    remainingMonths: Math.max(0, remainingMonths),
    remainingAmount,
    totalAmount,
    isCompleted: remainingMonths <= 0,
  };
}

// ─── Dư nợ sao kê ─────────────────────────────────────────────────────────

export interface CardTx {
  amount: number | string;
  type: "INCOME" | "EXPENSE" | string;
  recordedAt: Date | string;
}

export interface StatementSummary extends StatementCycle {
  /** Dư nợ tại thời điểm chốt sao kê gần nhất (gồm cả gốc trả góp chưa đến kỳ). */
  debtAtStatement: number;
  /** Số tiền phải thanh toán của kỳ sao kê (đã trừ phần trả góp chưa đến kỳ). */
  statementAmount: number;
  /** Thanh toán / hoàn tiền ghi nhận sau ngày chốt. */
  paidSinceStatement: number;
  /** Số tiền còn phải trả của kỳ sao kê. */
  remainingDue: number;
  /** Tiền trả góp đến kỳ trong sao kê gần nhất. */
  installmentDueThisStatement: number;
  status: "NO_DUE" | "PAID" | "DUE" | "DUE_SOON" | "OVERDUE";
}

/** Số ngày trước hạn để coi là "sắp đến hạn". */
export const DUE_SOON_DAYS = 7;

/**
 * Tính dư nợ sao kê gần nhất của một thẻ.
 * @param initialBalance số dư ban đầu của ví (âm = dư nợ ban đầu)
 * @param txs toàn bộ giao dịch của ví thẻ (kể cả chuyển khoản / thanh toán thẻ)
 */
export function getStatementSummary(
  card: { initialBalance: number; statementDay: number | null | undefined; paymentDueDay: number | null | undefined },
  txs: CardTx[],
  installments: InstallmentLike[] = [],
  now: Date = new Date()
): StatementSummary {
  const cycle = getStatementCycle(card.statementDay, card.paymentDueDay, now);
  const endMs = cycle.periodEnd.getTime();

  // Toàn bộ phép tính bằng xu (số nguyên) để không lệch dù chỉ 0,01 ₫.
  let balanceAtClose = toCents(card.initialBalance);
  let paidSinceStatement = 0;
  for (const t of txs) {
    const ms = new Date(t.recordedAt).getTime();
    const amt = toCents(t.amount);
    if (ms < endMs) {
      balanceAtClose += t.type === "INCOME" ? amt : -amt;
    } else if (t.type === "INCOME") {
      paidSinceStatement += amt;
    }
  }
  const debtAtStatement = Math.max(0, -balanceAtClose);

  let notYetDue = 0;
  let installmentDueThisStatement = 0;
  const prevStmt = new Date(cycle.periodStart.getTime() - DAY_MS);
  for (const inst of installments) {
    if (new Date(inst.startDate).getTime() >= endMs) continue; // tạo sau kỳ chốt
    const months = Math.max(1, Math.floor(inst.months));
    const schedule = getInstallmentSchedule(inst);
    const total = scheduleCentsUpTo(schedule, months);
    const dueCount = getInstallmentDueCount(inst, card.statementDay, cycle.lastStatementDate);
    const prevCount = getInstallmentDueCount(inst, card.statementDay, prevStmt);
    installmentDueThisStatement += scheduleCentsUpTo(schedule, dueCount) - scheduleCentsUpTo(schedule, prevCount);
    notYetDue += total - scheduleCentsUpTo(schedule, dueCount);
  }

  const statementAmount = Math.max(0, debtAtStatement - notYetDue);
  const remainingDue = Math.max(0, statementAmount - paidSinceStatement);

  let status: StatementSummary["status"];
  if (statementAmount <= 0) status = "NO_DUE";
  else if (remainingDue <= 0) status = "PAID";
  else if (cycle.daysUntilDue < 0) status = "OVERDUE";
  else if (cycle.daysUntilDue <= DUE_SOON_DAYS) status = "DUE_SOON";
  else status = "DUE";

  return {
    ...cycle,
    debtAtStatement: fromCents(debtAtStatement),
    statementAmount: fromCents(statementAmount),
    paidSinceStatement: fromCents(paidSinceStatement),
    remainingDue: fromCents(remainingDue),
    installmentDueThisStatement: fromCents(installmentDueThisStatement),
    status,
  };
}

// ─── Import sao kê: nhận diện thanh toán thẻ tín dụng ─────────────────────

function normalizeText(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u{300}-\u{36f}]/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const REFUND_RE = /\b(hoan tien|hoan tra|hoan phi|refund|cash ?back|reversal|reversed|tra lai|dieu chinh giam)\b/;
const CARD_SIDE_PAYMENT_RE =
  /\b(thanh toan|ttoan|tt|payment|tra no|trich no|auto ?debit|nop tien|nap tien|ghi co thanh toan)\b/;
/** Nhắc rõ đến thẻ tín dụng. */
const CREDIT_CARD_RE = /\b(the tin dung|credit ?card|the td|tttd|ttttd)\b/;
/** Chỉ nêu tên tổ chức thẻ — có thể là thẻ ghi nợ, nên cần thêm cụm "trả nợ thẻ" mới tính. */
const CARD_NETWORK_RE = /\b(visa|master ?card|jcb|amex)\b/;
const BANK_SIDE_PAYMENT_RE = /\b(thanh toan|ttoan|tt|tra no|payment|nop|auto ?debit|trich no)\b/;
// "thanh toan the Visa ..." cũng có thể là quẹt thẻ mua hàng, nên chỉ nhận các cụm nói rõ việc trả nợ.
const CARD_DEBT_PAYMENT_RE = /\b(tra no|du no|sao ke|card payment|auto ?debit|trich no)\b/;
/** Giao dịch bằng thẻ ghi nợ (mua hàng thật), không phải trả nợ thẻ tín dụng. */
const DEBIT_CARD_RE = /\b(the ghi no|debit card|napas)\b|(?<!auto ?)\bdebit\b/;

/**
 * Gợi ý một dòng sao kê là "thanh toán thẻ tín dụng" — tức chuyển khoản nội bộ, KHÔNG phải thu/chi thật
 * (chi tiêu đã được tính lúc quẹt thẻ).
 *  - Sao kê thẻ tín dụng: dòng ghi có (INCOME) là khoản thanh toán / trích nợ tự động (trừ hoàn tiền).
 *  - Sao kê ngân hàng / ví: dòng chi (EXPENSE) trả nợ thẻ tín dụng.
 */
export function suggestCardPaymentTransfer(
  targetKind: WalletKind | null | undefined,
  type: "INCOME" | "EXPENSE" | string,
  note: string | null | undefined
): boolean {
  const n = normalizeText(note ?? "");
  if (!n) return false;
  if (targetKind === "CREDIT") {
    return type === "INCOME" && CARD_SIDE_PAYMENT_RE.test(n) && !REFUND_RE.test(n);
  }
  if (targetKind === "BANK" || targetKind === "CASH") {
    if (type !== "EXPENSE" || DEBIT_CARD_RE.test(n)) return false;
    if (CREDIT_CARD_RE.test(n)) return BANK_SIDE_PAYMENT_RE.test(n);
    return CARD_NETWORK_RE.test(n) && CARD_DEBT_PAYMENT_RE.test(n);
  }
  return false;
}

/** Khớp ví với số tài khoản / số thẻ phát hiện trong sao kê (thẻ chỉ lưu 4 số cuối). */
export function matchesDetectedAccount(
  wallet: { accountNumber?: string | null; type?: string | null; bankName?: string | null; name?: string | null },
  detected: string | null | undefined
): boolean {
  const acc = (wallet.accountNumber || "").replace(/\s+/g, "");
  const det = (detected || "").replace(/[\s*xX•-]+/g, "");
  if (!acc || !det) return false;
  if (acc === det) return true;
  return getWalletKind(wallet) === "CREDIT" && acc.length >= 4 && det.endsWith(acc.slice(-4));
}
