"use client";

import { useState, useTransition } from "react";
import type { ParsedTransaction } from "@/schemas/ai-import";
import { confirmAiImport } from "@/actions/ai-import";
import { useRouter } from "next/navigation";
import { maskAccountNumber } from "@/lib/utils";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";

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
  duplicateCount?: number;
  wallets?: { id: string; name: string; bankName?: string | null; accountNumber?: string | null }[];
  categories?: { id: string; name: string; type: string; color?: string; icon?: string | null }[];
  onReset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  duplicateCount,
  wallets = [],
  categories = [],
  onReset,
}: ImportReviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedWalletId, setSelectedWalletId] = useState<string>(() => {
    return wallets.length > 0 ? wallets[0].id : "";
  });

  // Tự động bỏ chọn các giao dịch bị phát hiện trùng lặp với Database
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    transactions.map((t, i) => ({
      ...t,
      _id: `row-${i}`,
      _selected: !t.duplicateInfo?.isDuplicate,
    }))
  );

  const [filterMode, setFilterMode] = useState<"all" | "valid" | "duplicate">("all");

  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported?: number;
    error?: string;
  } | null>(null);

  // Thống kê trùng lặp
  const totalDuplicates = rows.filter((r) => r.duplicateInfo?.isDuplicate).length;
  const totalValid = rows.length - totalDuplicates;
  const selectedCount = rows.filter((r) => r._selected).length;

  // Lọc danh sách theo filterMode
  const visibleRows = rows.filter((r) => {
    if (filterMode === "valid") return !r.duplicateInfo?.isDuplicate;
    if (filterMode === "duplicate") return Boolean(r.duplicateInfo?.isDuplicate);
    return true;
  });

  // ── Select all toggle ──
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => r._selected);
  const toggleAllVisible = () => {
    const nextState = !allVisibleSelected;
    const visibleIds = new Set(visibleRows.map((r) => r._id));
    setRows((prev) =>
      prev.map((r) => (visibleIds.has(r._id) ? { ...r, _selected: nextState } : r))
    );
  };

  // ── Toggle single row ──
  const toggleRow = (id: string) =>
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, _selected: !r._selected } : r))
    );

  // ── Thao tác nhanh trùng lặp ──
  const deselectDuplicates = () => {
    setRows((prev) =>
      prev.map((r) => (r.duplicateInfo?.isDuplicate ? { ...r, _selected: false } : r))
    );
  };

  const selectValidOnly = () => {
    setRows((prev) =>
      prev.map((r) => ({ ...r, _selected: !r.duplicateInfo?.isDuplicate }))
    );
  };

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
        walletId: selectedWalletId || null,
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

  // ── Success state ──
  if (importResult?.success) {
    return (
      <div className="import-success-card">
        <div className="success-icon">✅</div>
        <h2 className="text-2xl font-bold mb-2">Import thành công!</h2>
        <p className="text-muted">
          Đã thêm <strong className="text-income">{importResult.imported} giao dịch</strong> vào OwnWallet.
        </p>
        <p className="text-subtle text-sm mt-1">Đang chuyển hướng về Giao dịch…</p>
      </div>
    );
  }

  return (
    <div className="review-wrapper space-y-4">
      {/* Category Suggestions Datalists */}
      <datalist id="category-datalist-INCOME">
        {categories
          .filter((c) => c.type === "INCOME")
          .map((c) => (
            <option key={c.id} value={c.name} />
          ))}
      </datalist>
      <datalist id="category-datalist-EXPENSE">
        {categories
          .filter((c) => c.type === "EXPENSE")
          .map((c) => (
            <option key={c.id} value={c.name} />
          ))}
      </datalist>
      <datalist id="category-datalist-ALL">
        {categories.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>

      {/* ── Header stats & Duplicate Alert Banner ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="review-stats">
          <div className="stat-chip stat-found">
            <span>📄</span>
            <span>Tìm thấy <strong>{totalFound}</strong></span>
          </div>
          {totalDuplicates > 0 && (
            <div className="stat-chip border-amber-300 bg-amber-50 text-amber-800">
              <span>⚠️</span>
              <span>Trùng lặp: <strong>{totalDuplicates}</strong> (Đã tự động bỏ chọn)</span>
            </div>
          )}
          <div className="stat-chip stat-selected">
            <span>☑️</span>
            <span>Sẵn sàng import: <strong>{selectedCount}</strong> / {rows.length}</span>
          </div>
          {skipped > 0 && (
            <div className="stat-chip stat-skipped">
              <span>⚠️</span>
              <span>Bỏ qua <strong>{skipped}</strong></span>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              filterMode === "all" ? "bg-white shadow-2xs text-foreground font-bold" : "text-slate-600 hover:text-foreground"
            }`}
          >
            Tất cả ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("valid")}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              filterMode === "valid" ? "bg-white shadow-2xs text-emerald-700 font-bold" : "text-slate-600 hover:text-emerald-700"
            }`}
          >
            Hợp lệ ({totalValid})
          </button>
          {totalDuplicates > 0 && (
            <button
              type="button"
              onClick={() => setFilterMode("duplicate")}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterMode === "duplicate" ? "bg-white shadow-2xs text-amber-700 font-bold" : "text-slate-600 hover:text-amber-700"
              }`}
            >
              Trùng lặp ({totalDuplicates})
            </button>
          )}
        </div>
      </div>

      {/* Duplicate Warning Notice */}
      {totalDuplicates > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <div>
              <span className="font-bold">Đã đối chiếu với cơ sở dữ liệu:</span> Phát hiện {totalDuplicates} giao dịch đã tồn tại hoặc trùng lặp tiềm ẩn.
              Hệ thống đã <strong>tự động bỏ chọn</strong> các mục này để tránh duplicate dữ liệu.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={deselectDuplicates}
              className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-100/60 font-semibold cursor-pointer transition-colors"
            >
              Bỏ chọn lại tất cả trùng lặp
            </button>
            <button
              type="button"
              onClick={selectValidOnly}
              className="px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-semibold cursor-pointer transition-colors"
            >
              Chỉ chọn mục hợp lệ
            </button>
          </div>
        </div>
      )}

      {/* ── Wallet Selector ── */}
      {wallets.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-card border border-border rounded-xl shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-600 text-base">
              💳
            </div>
            <div>
              <span className="text-xs font-bold text-foreground block">
                Tài khoản nhận giao dịch:
              </span>
              <span className="text-[11px] text-muted-foreground">
                Tất cả giao dịch import được chọn sẽ liên kết với tài khoản này
              </span>
            </div>
          </div>
          <select
            value={selectedWalletId}
            onChange={(e) => setSelectedWalletId(e.target.value)}
            className="text-xs font-bold px-3 py-2 rounded-lg border border-border bg-card text-foreground outline-none cursor-pointer focus:border-primary shrink-0 shadow-2xs"
          >
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.bankName === "CASH" ? "💵" : "💳"} {w.name} {w.accountNumber && w.bankName !== "CASH" ? `(STK: ${maskAccountNumber(w.accountNumber)})` : ""}
              </option>
            ))}
            <option value="">-- Chưa gán tài khoản --</option>
          </select>
        </div>
      )}

      {/* ── Error message ── */}
      {importResult?.error && (
        <div className="error-banner">⚠️ {importResult.error}</div>
      )}

      {/* ── Table ── */}
      <div className="review-table-wrapper">
        <table className="review-table">
          <thead>
            <tr>
              <th className="w-10 text-center">
                <input
                  id="select-all-toggle"
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="row-checkbox"
                  title="Chọn / Bỏ chọn tất cả mục hiển thị"
                />
              </th>
              <th>Ngày giờ</th>
              <th>Loại</th>
              <th>Số tiền</th>
              <th>Danh mục</th>
              <th>Ghi chú & Trạng thái đối chiếu</th>
              <th>Tin cậy</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const badge = confidenceBadge(row.confidence);
              const isDup = row.duplicateInfo?.isDuplicate;
              return (
                <tr
                  key={row._id}
                  className={`review-row transition-colors ${
                    !row._selected ? "row-deselected" : ""
                  } ${isDup ? "bg-amber-50/40 hover:bg-amber-50/70" : ""}`}
                >
                  {/* Checkbox */}
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={row._selected}
                      onChange={() => toggleRow(row._id)}
                      className="row-checkbox cursor-pointer"
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

                  <td className="cell-amount">
                    <SmartCurrencyInput
                      id={`row-amount-${row._id}`}
                      value={row.amount}
                      onChangeValue={(val) => updateRow(row._id, "amount", val)}
                      currencySymbol=""
                      className={`amount-input ${row.type === "INCOME" ? "text-income" : "text-expense"}`}
                    />
                  </td>

                  {/* Category */}
                  <td>
                    <input
                      id={`row-cat-${row._id}`}
                      type="text"
                      list={row.type === "INCOME" ? "category-datalist-INCOME" : "category-datalist-EXPENSE"}
                      value={row.categoryName}
                      placeholder="Chọn hoặc nhập..."
                      onChange={(e) =>
                        updateRow(row._id, "categoryName", e.target.value)
                      }
                      className="cat-input"
                    />
                  </td>

                  {/* Note & Duplicate Info */}
                  <td className="min-w-[220px]">
                    <input
                      id={`row-note-${row._id}`}
                      type="text"
                      value={row.note ?? ""}
                      onChange={(e) =>
                        updateRow(row._id, "note", e.target.value)
                      }
                      placeholder="Ghi chú giao dịch..."
                      className="note-input"
                    />

                    {/* Duplicate Warning Badge */}
                    {isDup && (
                      <div className="mt-1 flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-100/90 px-2 py-1 rounded-md border border-amber-200 leading-tight">
                        <span className="shrink-0 text-amber-600 font-bold">⚠️</span>
                        <div>
                          <span className="font-semibold">
                            {row.duplicateInfo?.type === "EXACT" ? "Đã có trong DB:" : "Trùng lặp tiềm ẩn:"}
                          </span>{" "}
                          <span>{row.duplicateInfo?.reason}</span>
                          {row.duplicateInfo?.matchedTx && (
                            <span className="block text-[10px] text-amber-700 mt-0.5">
                              (Khớp với GD: {formatDate(row.duplicateInfo.matchedTx.recordedAt)} ·{" "}
                              {new Intl.NumberFormat("vi-VN").format(row.duplicateInfo.matchedTx.amount)}đ
                              {row.duplicateInfo.matchedTx.note ? ` · "${row.duplicateInfo.matchedTx.note}"` : ""})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
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
