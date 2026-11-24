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
