import test from "node:test";
import assert from "node:assert/strict";
import { parseExcelOrCsvLocally } from "../ai/localStatementParser";

test("CSV import: Vietnamese dates and decimal amounts are read exactly", () => {
  const csv = [
    "Ngày giao dịch,Mô tả,Số tiền",
    '05/11/2026,SHOPEE MUA HANG,"1.234.567,89"',
    '08/11/2026,GRAB BIKE,"45.000,5"',
    '15/11/2026,THANH TOAN THE TU TK 1234,"2.000.000 CR"',
  ].join("\n");
  const r = parseExcelOrCsvLocally(Buffer.from(csv, "utf8"), ["Mua sắm", "Di chuyển"]);
  assert.ok(r);
  const rows = r!.transactions.map((t) => [t.recordedAt.slice(0, 10), t.type, t.amount]);
  assert.deepEqual(rows, [
    ["2026-11-05", "EXPENSE", 1234567.89],
    ["2026-11-08", "EXPENSE", 45000.5],
    ["2026-11-15", "INCOME", 2000000],
  ]);
});

test("CSV import: signed amount column (no type column) — negative = expense, positive = income", () => {
  const csv = [
    "Ngày giao dịch,Mô tả,Số tiền",
    '01/11/2026,LUONG THANG 10,"15.000.000"',
    '02/11/2026,SHOPEE MUA HANG,"-250.000"',
  ].join("\n");
  const r = parseExcelOrCsvLocally(Buffer.from(csv, "utf8"), []);
  assert.ok(r);
  assert.deepEqual(
    r!.transactions.map((t) => [t.type, t.amount]),
    [
      ["INCOME", 15000000],
      ["EXPENSE", 250000],
    ]
  );
});

test("CSV import: unsigned amounts keep the old default (expense)", () => {
  const csv = ["Ngày giao dịch,Mô tả,Số tiền", '01/11/2026,GRAB,"50.000"', '02/11/2026,CAFE,"30.000"'].join("\n");
  const r = parseExcelOrCsvLocally(Buffer.from(csv, "utf8"), []);
  assert.deepEqual(r!.transactions.map((t) => t.type), ["EXPENSE", "EXPENSE"]);
});

test("CSV import: credit card statement — negative lines are payments (income)", () => {
  const csv = [
    "Sao kê thẻ tín dụng,4123 **** **** 5678",
    "Hạn mức tín dụng,50.000.000",
    "Ngày giao dịch,Mô tả,Số tiền",
    '03/11/2026,SHOPEE MUA HANG,"1.200.000"',
    '10/11/2026,THANH TOAN THE,"-5.000.000"',
  ].join("\n");
  const r = parseExcelOrCsvLocally(Buffer.from(csv, "utf8"), []);
  assert.ok(r);
  assert.deepEqual(
    r!.transactions.map((t) => [t.type, t.amount]),
    [
      ["EXPENSE", 1200000],
      ["INCOME", 5000000],
    ]
  );
});
