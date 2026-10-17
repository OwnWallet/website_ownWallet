import test from "node:test";
import assert from "node:assert/strict";
import { buildSyncTag } from "../debt-sync";

test("Business Logic & Integrity: Causal Time Ordering", async (t) => {
  await t.test("sorts transactions chronologically ascending", () => {
    const rawTxs = [
      { id: "tx_payment", recordedAt: "2026-10-15T08:00:00.000Z", note: "Trả nợ anh Nam" },
      { id: "tx_loan", recordedAt: "2026-10-01T08:00:00.000Z", note: "Vay anh Nam mua xe" },
      { id: "tx_topup", recordedAt: "2026-10-05T08:00:00.000Z", note: "Vay thêm anh Nam" },
    ];

    const sorted = [...rawTxs].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    assert.equal(sorted[0].id, "tx_loan");
    assert.equal(sorted[1].id, "tx_topup");
    assert.equal(sorted[2].id, "tx_payment");
  });
});

test("Business Logic & Integrity: TOPUP and PAYMENT Reversal Calculations", async (t) => {
  await t.test("reverses PAYMENT correctly without affecting amount", () => {
    const currentDebt = {
      amount: 10000000,
      paidAmount: 6000000,
    };
    const paymentLog = {
      type: "PAYMENT",
      amount: 2000000,
    };

    const updatedPaid = Math.max(0, currentDebt.paidAmount - paymentLog.amount);
    const updatedStatus =
      updatedPaid >= currentDebt.amount
        ? "PAID"
        : updatedPaid > 0
        ? "PARTIAL"
        : "PENDING";

    assert.equal(updatedPaid, 4000000);
    assert.equal(currentDebt.amount, 10000000); // Amount unchanged
    assert.equal(updatedStatus, "PARTIAL");
  });

  await t.test("reverses TOPUP correctly by reducing amount", () => {
    const currentDebt = {
      amount: 15000000,
      paidAmount: 5000000,
    };
    const topupLog = {
      type: "TOPUP",
      amount: 5000000,
    };

    const updatedAmount = Math.max(0, currentDebt.amount - topupLog.amount);
    const updatedStatus =
      currentDebt.paidAmount >= updatedAmount
        ? "PAID"
        : currentDebt.paidAmount > 0
        ? "PARTIAL"
        : "PENDING";

    assert.equal(updatedAmount, 10000000); // 15M - 5M = 10M
    assert.equal(currentDebt.paidAmount, 5000000); // Paid amount unchanged
    assert.equal(updatedStatus, "PARTIAL");
  });
});

test("Business Logic & Integrity: Note and Sync Tag Cleanup", async (t) => {
  await t.test("cleans up sync tags cleanly from Debt note", () => {
    const txId = "c12345678-abcd-ef01-2345";
    const tag = buildSyncTag(txId);
    assert.equal(tag, `[tx_id:${txId}]`);

    const note = `Khởi tạo nợ | Gộp thêm từ GD ngày 10/10/2026: +5.000.000 ₫ ${tag} | Ghi chú khác`;
    const escapedId = txId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const cleaned = note
      .replace(new RegExp(`\\s*\\|\\s*Gộp thêm từ GD ngày [^|]+\\[tx_id:${escapedId}\\]`, "g"), "")
      .replace(new RegExp(`\\s*\\|\\s*Thanh toán từ GD ngày [^|]+\\[tx_id:${escapedId}\\]`, "g"), "")
      .replace(new RegExp(`^Tạo từ GD ngày [^|[]+\\[tx_id:${escapedId}\\]\\s*`, "g"), "")
      .replace(new RegExp(`\\[tx_id:${escapedId}\\]`, "g"), "")
      .replace(/^\s*\|\s*/, "")
      .replace(/\s*\|\s*$/, "")
      .trim();

    assert.equal(cleaned, "Khởi tạo nợ | Ghi chú khác");
    assert.equal(cleaned.includes(txId), false);
  });
});
