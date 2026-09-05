"use client";

import { useState, useTransition } from "react";
import type { ParsedTransaction } from "@/schemas/ai-import";
import { confirmAiImport } from "@/actions/ai-import";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ReviewRow extends ParsedTransaction {
  _id: string; // unique key cho list
  _selected: boolean;
}

interface ImportReviewProps {
  transactions: ParsedTransaction[];
  totalFound: number;
  skipped: number;
  onReset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatAmount(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function confidenceBadge(c: number) {
  if (c >= 0.85)
    return { label: `${Math.round(c * 100)}%`, cls: "badge-success" };
  if (c >= 0.65)
    return { label: `${Math.round(c * 100)}%`, cls: "badge-warning" };
  return { label: `${Math.round(c * 100)}%`, cls: "badge-danger" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportReview({
  transactions,
  totalFound,
  skipped,
  onReset,
}: ImportReviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<ReviewRow[]>(() =>
    transactions.map((t, i) => ({
      ...t,
      _id: `row-${i}`,
      _selected: true,
    }))
  );

  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported?: number;
    error?: string;
  } | null>(null);

  // ── Select all toggle ──
  const allSelected = rows.every((r) => r._selected);
  const toggleAll = () =>
    setRows((prev) => prev.map((r) => ({ ...r, _selected: !allSelected })));

  // ── Toggle single row ──
  const toggleRow = (id: string) =>
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, _selected: !r._selected } : r))
    );

  // ── Edit cell ──
  const updateRow = (id: string, field: keyof ParsedTransaction, value: string | number) =>
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, [field]: value } : r))
    );

  // ── Confirm import ──
  const handleConfirm = () => {
    const selected = rows.filter((r) => r._selected);
    if (selected.length === 0) return;

    startTransition(async () => {
      const result = await confirmAiImport({
        transactions: selected.map(({ amount, type, categoryName, note, recordedAt }) => ({
          amount,
          type,
          categoryName,
          note,
          recordedAt,
        })),
      });

      setImportResult(result);
      if (result.success) {
        setTimeout(() => router.push("/transactions"), 1800);
      }
    });
  };

  const selectedCount = rows.filter((r) => r._selected).length;

  // ── Success state ──
  if (importResult?.success) {
    return (
      <div className="import-success-card">
        <div className="success-icon">✅</div>
        <h2 className="text-2xl font-bold mb-2">Import thành công!</h2>
        <p className="text-muted">
          Đã thêm <strong className="text-income">{importResult.imported} giao dịch</strong> vào wnWallet.
        </p>
        <p className="text-subtle text-sm mt-1">Đang chuyển hướng về Giao dịch…</p>
      </div>
    );
  }

  return (
    <div className="review-wrapper">
      {/* ── Header stats ── */}
      <div className="review-stats">
        <div className="stat-chip stat-found">
          <span>📄</span>
          <span>Tìm thấy <strong>{totalFound}</strong></span>
        </div>
        {skipped > 0 && (
          <div className="stat-chip stat-skipped">
            <span>⚠️</span>
            <span>Bỏ qua <strong>{skipped}</strong></span>
          </div>
        )}
        <div className="stat-chip stat-selected">
          <span>☑️</span>
          <span>Đã chọn <strong>{selectedCount}</strong></span>
        </div>
      </div>

      {/* ── Error message ── */}
      {importResult?.error && (
        <div className="error-banner">⚠️ {importResult.error}</div>
      )}

      {/* ── Table ── */}
      <div className="review-table-wrapper">
        <table className="review-table">
          <thead>
            <tr>
              <th>
                <input
                  id="select-all-toggle"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="row-checkbox"
                />
              </th>
              <th>Ngày giờ</th>
              <th>Loại</th>
              <th>Số tiền</th>
              <th>Danh mục</th>
              <th>Ghi chú</th>
              <th>Tin cậy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const badge = confidenceBadge(row.confidence);
              return (
                <tr
                  key={row._id}
                  className={`review-row ${!row._selected ? "row-deselected" : ""}`}
                >
                  {/* Checkbox */}
                  <td>
                    <input
                      type="checkbox"
                      checked={row._selected}
                      onChange={() => toggleRow(row._id)}
                      className="row-checkbox"
                      id={`row-check-${row._id}`}
                    />
                  </td>

                  {/* Date */}
                  <td className="cell-date text-subtle text-sm">
                    {formatDate(row.recordedAt)}
                  </td>

                  {/* Type badge */}
                  <td>
                    <select
                      id={`row-type-${row._id}`}
                      value={row.type}
                      onChange={(e) =>
                        updateRow(row._id, "type", e.target.value)
                      }
                      className={`type-select ${row.type === "INCOME" ? "type-income" : "type-expense"}`}
                    >
                      <option value="INCOME">Thu nhập</option>
                      <option value="EXPENSE">Chi tiêu</option>
                    </select>
                  </td>

                  {/* Amount */}
                  <td className="cell-amount">
                    <input
                      id={`row-amount-${row._id}`}
                      type="number"
                      value={row.amount}
                      min={0}
                      step={1000}
                      onChange={(e) =>
                        updateRow(row._id, "amount", parseFloat(e.target.value) || 0)
                      }
                      className={`amount-input ${row.type === "INCOME" ? "text-income" : "text-expense"}`}
                    />
                  </td>

                  {/* Category */}
                  <td>
                    <input
                      id={`row-cat-${row._id}`}
                      type="text"
                      value={row.categoryName}
                      onChange={(e) =>
                        updateRow(row._id, "categoryName", e.target.value)
                      }
                      className="cat-input"
                    />
                  </td>

                  {/* Note */}
                  <td>
                    <input
                      id={`row-note-${row._id}`}
                      type="text"
                      value={row.note ?? ""}
                      onChange={(e) =>
                        updateRow(row._id, "note", e.target.value)
                      }
                      className="note-input"
                    />
                  </td>

                  {/* Confidence badge */}
                  <td>
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Actions ── */}
      <div className="review-actions">
        <button
          id="btn-reset-import"
          type="button"
          onClick={onReset}
          className="btn-secondary"
          disabled={isPending}
        >
          ← Upload file khác
        </button>

        <button
          id="btn-confirm-import"
          type="button"
          onClick={handleConfirm}
          disabled={selectedCount === 0 || isPending}
          className="btn-primary"
        >
          {isPending
            ? "Đang lưu…"
            : `✅ Xác nhận import ${selectedCount} giao dịch`}
        </button>
      </div>
    </div>
  );
}
