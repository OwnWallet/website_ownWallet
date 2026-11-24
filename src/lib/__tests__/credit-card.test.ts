import test from "node:test";
import assert from "node:assert/strict";
import {
  getWalletKind,
  getCreditDebt,
  getCreditUtilization,
  getUtilizationLevel,
  getStatementCycle,
  getInstallmentDueCount,
  getInstallmentMonthlyAmount,
  getInstallmentProgress,
  getStatementSummary,
  suggestCardPaymentTransfer,
  matchesDetectedAccount,
} from "../credit-card";

/** Thời điểm theo giờ Việt Nam (UTC+7). */
const vn = (y: number, m: number, d: number, h = 12) => new Date(Date.UTC(y, m - 1, d, h - 7));
const ymd = (date: Date) => {
  const s = new Date(date.getTime() + 7 * 3600 * 1000);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
};

test("Credit card: wallet kind", async (t) => {
  await t.test("prefers explicit type, falls back to cash heuristic", () => {
    assert.equal(getWalletKind({ type: "CREDIT", bankName: "TPBank" }), "CREDIT");
    assert.equal(getWalletKind({ type: "BANK", bankName: "CASH" }), "CASH");
    assert.equal(getWalletKind({ type: "BANK", name: "Tiền mặt trong ví" }), "CASH");
    assert.equal(getWalletKind({ type: "BANK", bankName: "Techcombank" }), "BANK");
    assert.equal(getWalletKind({}), "BANK");
  });
});

test("Credit card: debt & utilization", async (t) => {
  await t.test("debt is the negative part of the balance", () => {
    assert.equal(getCreditDebt(-5_000_000), 5_000_000);
    assert.equal(getCreditDebt(200_000), 0);
  });
  await t.test("utilization percent and level", () => {
    assert.equal(getCreditUtilization(5_000_000, 50_000_000), 10);
    assert.equal(getCreditUtilization(1, 0), 0);
    assert.equal(getUtilizationLevel(10), "low");
    assert.equal(getUtilizationLevel(45), "medium");
    assert.equal(getUtilizationLevel(85), "high");
  });
});

test("Credit card: statement cycle", async (t) => {
  await t.test("after statement day: last statement is this month, due next month", () => {
    const c = getStatementCycle(20, 5, vn(2026, 11, 24));
    assert.equal(ymd(c.lastStatementDate), "2026-11-20");
    assert.equal(ymd(c.periodStart), "2026-10-21");
    assert.equal(ymd(c.periodEnd), "2026-11-21");
    assert.equal(ymd(c.nextStatementDate), "2026-12-20");
    assert.equal(ymd(c.dueDate), "2026-12-05");
    assert.equal(c.daysUntilDue, 11);
  });
  await t.test("on statement day the statement is not closed yet", () => {
    const c = getStatementCycle(20, 5, vn(2026, 11, 20, 23));
    assert.equal(ymd(c.lastStatementDate), "2026-10-20");
    assert.equal(ymd(c.dueDate), "2026-11-05");
    assert.equal(c.daysUntilDue, -15);
  });
  await t.test("due day after statement day stays in the same month", () => {
    const c = getStatementCycle(5, 25, vn(2026, 11, 10));
    assert.equal(ymd(c.lastStatementDate), "2026-11-05");
    assert.equal(ymd(c.dueDate), "2026-11-25");
  });
  await t.test("clamps day 31 to end of short months and crosses years", () => {
    const c = getStatementCycle(31, 15, vn(2027, 3, 1));
    assert.equal(ymd(c.lastStatementDate), "2027-02-28");
    assert.equal(ymd(c.periodStart), "2027-02-01");
    assert.equal(ymd(c.dueDate), "2027-03-15");
    const j = getStatementCycle(25, 10, vn(2027, 1, 3));
    assert.equal(ymd(j.lastStatementDate), "2026-12-25");
    assert.equal(ymd(j.dueDate), "2027-01-10");
  });
  await t.test("defaults to statement + 15 days without due day", () => {
    const c = getStatementCycle(20, null, vn(2026, 11, 24));
    assert.equal(ymd(c.dueDate), "2026-12-05");
  });
});

test("Credit card: installments", async (t) => {
  const inst = { principal: 12_000_000, months: 6, feeAmount: 300_000, startDate: vn(2026, 9, 10) };
  await t.test("monthly amount includes fee", () => {
    assert.equal(getInstallmentMonthlyAmount(inst), 2_050_000);
  });
  await t.test("first instalment lands on the first statement after start", () => {
    assert.equal(getInstallmentDueCount(inst, 20, vn(2026, 8, 20)), 0);
    assert.equal(getInstallmentDueCount(inst, 20, vn(2026, 9, 20)), 1);
    assert.equal(getInstallmentDueCount(inst, 20, vn(2026, 11, 20)), 3);
    assert.equal(getInstallmentDueCount(inst, 20, vn(2027, 6, 20)), 6);
  });
  await t.test("progress counts closed statements", () => {
    const p = getInstallmentProgress(inst, 20, vn(2026, 11, 24));
    assert.equal(p.paidMonths, 3);
    assert.equal(p.remainingMonths, 3);
    assert.equal(p.remainingAmount, 6_150_000);
    assert.equal(p.isCompleted, false);
    assert.equal(getInstallmentProgress(inst, 20, vn(2027, 4, 1)).isCompleted, true);
  });
});

test("Credit card: exact to the cent", async (t) => {
  await t.test("non-divisible installment keeps every cent", () => {
    const inst = { principal: 1_000_000, months: 3, feeAmount: 0.01, startDate: vn(2026, 9, 10) };
    assert.equal(getInstallmentMonthlyAmount(inst), 333_333.33);
    const p = getInstallmentProgress(inst, 20, vn(2026, 10, 24)); // 2 kỳ đã vào sao kê
    assert.equal(p.paidMonths, 2);
    assert.equal(p.lastAmount, 333_333.35);
    assert.equal(p.remainingAmount, 333_333.35);
    assert.equal(p.totalAmount, 1_000_000.01);
  });
  await t.test("decimal transactions sum exactly", () => {
    const card = { initialBalance: -0.1, statementDay: 20, paymentDueDay: 5 };
    const txs = [
      { amount: "0.2", type: "EXPENSE", recordedAt: vn(2026, 11, 2) },
      { amount: 1234.56, type: "EXPENSE", recordedAt: vn(2026, 11, 3) },
      { amount: "0.3", type: "INCOME", recordedAt: vn(2026, 11, 22) },
    ];
    const s = getStatementSummary(card, txs, [], vn(2026, 11, 24));
    assert.equal(s.statementAmount, 1234.86);
    assert.equal(s.remainingDue, 1234.56);
    assert.equal(getCreditDebt("-1234.86"), 1234.86);
  });
});

test("Credit card: statement summary", async (t) => {
  const card = { initialBalance: -1_000_000, statementDay: 20, paymentDueDay: 5 };
  const now = vn(2026, 11, 24);

  await t.test("statement amount = debt at close; payments after close reduce remaining", () => {
    const txs = [
      { amount: 2_000_000, type: "EXPENSE", recordedAt: vn(2026, 11, 2) },
      { amount: 500_000, type: "EXPENSE", recordedAt: vn(2026, 11, 22) }, // kỳ sau
      { amount: 1_200_000, type: "INCOME", recordedAt: vn(2026, 11, 23) }, // thanh toán
    ];
    const s = getStatementSummary(card, txs, [], now);
    assert.equal(s.debtAtStatement, 3_000_000);
    assert.equal(s.statementAmount, 3_000_000);
    assert.equal(s.paidSinceStatement, 1_200_000);
    assert.equal(s.remainingDue, 1_800_000);
    assert.equal(s.status, "DUE");
  });

  await t.test("installment principal not yet due is excluded from the statement", () => {
    const inst = { principal: 12_000_000, months: 6, feeAmount: 0, startDate: vn(2026, 10, 25) };
    const txs = [{ amount: 12_000_000, type: "EXPENSE", recordedAt: vn(2026, 10, 25) }];
    const s = getStatementSummary({ ...card, initialBalance: 0 }, txs, [inst], now);
    assert.equal(s.debtAtStatement, 12_000_000);
    assert.equal(s.installmentDueThisStatement, 2_000_000);
    assert.equal(s.statementAmount, 2_000_000);
  });

  await t.test("status flags due soon, paid, overdue", () => {
    const txs = [{ amount: 1_000_000, type: "EXPENSE", recordedAt: vn(2026, 11, 2) }];
    assert.equal(getStatementSummary(card, txs, [], vn(2026, 12, 1)).status, "DUE_SOON");
    assert.equal(getStatementSummary(card, txs, [], vn(2026, 12, 8)).status, "OVERDUE");
    const paid = [...txs, { amount: 2_000_000, type: "INCOME", recordedAt: vn(2026, 11, 25) }];
    assert.equal(getStatementSummary(card, paid, [], vn(2026, 12, 8)).status, "PAID");
    assert.equal(getStatementSummary({ ...card, initialBalance: 0 }, [], [], now).status, "NO_DUE");
  });
});

test("Credit card: statement import helpers", async (t) => {
  await t.test("card statement: payments are internal transfers, refunds stay income", () => {
    assert.equal(suggestCardPaymentTransfer("CREDIT", "INCOME", "THANH TOAN THE TU TK 123456"), true);
    assert.equal(suggestCardPaymentTransfer("CREDIT", "INCOME", "Payment - Thank you"), true);
    assert.equal(suggestCardPaymentTransfer("CREDIT", "INCOME", "Trích nợ tự động"), true);
    assert.equal(suggestCardPaymentTransfer("CREDIT", "INCOME", "Hoàn tiền SHOPEE"), false);
    assert.equal(suggestCardPaymentTransfer("CREDIT", "INCOME", "Cashback tháng 11"), false);
    assert.equal(suggestCardPaymentTransfer("CREDIT", "EXPENSE", "Thanh toan GRAB"), false);
  });
  await t.test("bank statement: paying the credit card is an internal transfer", () => {
    assert.equal(suggestCardPaymentTransfer("BANK", "EXPENSE", "TT the tin dung TPBank 4123"), true);
    assert.equal(suggestCardPaymentTransfer("BANK", "EXPENSE", "Thanh toán thẻ TD kỳ 11"), true);
    assert.equal(suggestCardPaymentTransfer("BANK", "EXPENSE", "Thanh toan hoa don dien"), false);
    assert.equal(suggestCardPaymentTransfer("BANK", "INCOME", "TT the tin dung"), false);
    assert.equal(suggestCardPaymentTransfer(null, "EXPENSE", "TT the tin dung"), false);
  });
  await t.test("matches card wallets by last 4 digits", () => {
    assert.equal(matchesDetectedAccount({ type: "CREDIT", accountNumber: "4123" }, "5254 **** **** 4123"), true);
    assert.equal(matchesDetectedAccount({ type: "BANK", accountNumber: "4123" }, "52544123"), false);
    assert.equal(matchesDetectedAccount({ type: "BANK", accountNumber: "0123456789" }, "0123 456 789"), true);
  });
});
