import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripDebtSystemNotes } from "../debt-sync";
import { parseDebtMetadata, encodeDebtMetadata } from "../debt-schedule";
import { computeDebtStatus } from "../debt-sync-db";
import { GoalSchema, GoalContributionSchema } from "../../schemas/goal";
import { DebtSchema, DebtUpdateSchema } from "../../schemas/debt";
import { TransactionSchema } from "../../schemas/transaction";

describe("GoalSchema — tạo mục tiêu", () => {
  it("chấp nhận hạn chót bỏ trống (chuỗi rỗng từ input date)", () => {
    const r = GoalSchema.safeParse({ name: "Mua xe", targetAmount: "50000000", deadline: "", note: "" });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.deadline, undefined);
      assert.equal(r.data.note, undefined);
    }
  });

  it("vẫn parse hạn chót hợp lệ", () => {
    const r = GoalSchema.safeParse({ name: "Quỹ", targetAmount: 1000, deadline: "2027-01-31" });
    assert.equal(r.success, true);
    if (r.success) assert.ok(r.data.deadline instanceof Date);
  });

  it("từ chối hạn chót không hợp lệ và tên rỗng", () => {
    assert.equal(GoalSchema.safeParse({ name: "X", targetAmount: 1, deadline: "abc" }).success, false);
    assert.equal(GoalSchema.safeParse({ name: "   ", targetAmount: 1 }).success, false);
  });

  it("nạp tiền với ngày rỗng dùng mặc định hôm nay", () => {
    const r = GoalContributionSchema.safeParse({ amount: "100000", recordedAt: "" });
    assert.equal(r.success, true);
    if (r.success) assert.ok(r.data.recordedAt instanceof Date);
  });
});

describe("stripDebtSystemNotes — note không còn phình to", () => {
  it("giữ ghi chú người dùng, bỏ các mệnh đề đồng bộ", () => {
    const note =
      "Vay mua laptop | Gộp thêm từ GD ngày 01/10/2026: +2.000.000 ₫ [tx_id:abc123] | Thanh toán từ GD ngày 05/10/2026: 500.000 ₫ [tx_id:def456]";
    assert.equal(stripDebtSystemNotes(note), "Vay mua laptop");
  });

  it("bỏ note chỉ gồm lịch sử hệ thống", () => {
    assert.equal(stripDebtSystemNotes("Tạo từ GD ngày 01/10/2026 [tx_id:abc]"), "");
    assert.equal(stripDebtSystemNotes("Gộp thêm +1.000.000 ₫ [tx_id:x1] | [tx_id:x2]"), "");
  });

  it("giữ nguyên tag [SCHEDULE:...]", () => {
    const encoded = encodeDebtMetadata("Ghi chú", { hasInterest: true, rate: 12, rateType: "year" });
    const withHistory = `${encoded} | Gộp thêm từ GD ngày 02/10/2026: +1 ₫ [tx_id:q]`;
    const cleaned = stripDebtSystemNotes(withHistory);
    const meta = parseDebtMetadata(cleaned);
    assert.equal(meta.cleanNote, "Ghi chú");
    assert.equal(meta.schedule?.rate, 12);
  });

  it("parseDebtMetadata trả về note sạch cho form sửa nợ", () => {
    const long = ["Ghi chú gốc", ...Array.from({ length: 40 }, (_, i) => `Gộp thêm từ GD ngày 0${i % 9 + 1}/10/2026: +1.000.000 ₫ [tx_id:t${i}]`)].join(" | ");
    assert.ok(long.length > 2000);
    const { cleanNote } = parseDebtMetadata(long);
    assert.equal(cleanNote, "Ghi chú gốc");
    // Sau khi dọn, form sửa nợ gửi lên sẽ hợp lệ
    assert.equal(
      DebtUpdateSchema.safeParse({ person: "A", amount: 1, direction: "OWE", note: cleanNote }).success,
      true
    );
  });
});

describe("Debt schemas — ngày phát sinh", () => {
  it("occurredAt rỗng → undefined, có giá trị → Date", () => {
    const a = DebtSchema.safeParse({ person: "A", amount: 1, direction: "OWE", occurredAt: "" });
    assert.equal(a.success, true);
    if (a.success) assert.equal(a.data.occurredAt, undefined);
    const b = DebtSchema.safeParse({ person: "A", amount: 1, direction: "OWE", occurredAt: "2026-09-01" });
    assert.equal(b.success, true);
    if (b.success) assert.ok(b.data.occurredAt instanceof Date);
  });
});

describe("TransactionSchema — đồng bộ nợ & gộp tùy chọn", () => {
  const base = { amount: 1000, type: "EXPENSE", categoryId: "c", recordedAt: "2026-10-01T10:00:00Z" };

  it('syncToDebt "false" không bị ép thành true', () => {
    const r = TransactionSchema.safeParse({ ...base, syncToDebt: "false" });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.syncToDebt, false);
  });

  it("debtMode mặc định NEW, chỉ MERGE khi chọn rõ", () => {
    const a = TransactionSchema.safeParse({ ...base, debtMode: "" });
    const b = TransactionSchema.safeParse({ ...base, debtMode: "MERGE", targetDebtId: "d1" });
    assert.ok(a.success && a.data.debtMode === "NEW");
    assert.ok(b.success && b.data.debtMode === "MERGE" && b.data.targetDebtId === "d1");
  });
});

describe("computeDebtStatus", () => {
  it("tính trạng thái theo số đã trả", () => {
    assert.equal(computeDebtStatus(100, 0), "PENDING");
    assert.equal(computeDebtStatus(100, 40), "PARTIAL");
    assert.equal(computeDebtStatus(100, 100), "PAID");
    assert.equal(computeDebtStatus(0, 0), "PENDING");
  });
});
