"use client";

import { useState } from "react";
import { createDebt, recordPayment } from "@/actions/debts";

export function DebtActions({
  debtId,
  mode = "add",
  wallets = [],
}: {
  debtId?: string;
  inline?: boolean;
  mode?: "add" | "record";
  wallets?: { id: string; name: string; balance: string | number | { toString: () => string } }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (mode === "record") {
    if (!isOpen) {
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="text-xs px-3 py-1.5 rounded transition-colors cursor-pointer"
          style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-strong)" }}
        >
          Ghi nhận trả
        </button>
      );
    }

    return (
      <form
        action={async (fd) => {
          setLoading(true);
          await recordPayment(debtId!, fd);
          setLoading(false);
          setIsOpen(false);
        }}
        className="flex flex-wrap gap-2 items-center"
      >
        <input
          type="number"
          name="paidAmount"
          placeholder="Số tiền..."
          required
          min="1"
          className="w-24 text-xs bg-background rounded px-2 py-1 text-foreground focus:outline-none"
          style={{ border: "1px solid var(--border-strong)" }}
        />
        {wallets.length > 0 && (
          <select
            name="walletId"
            className="text-xs bg-background rounded px-2 py-1 text-foreground focus:outline-none"
            style={{ border: "1px solid var(--border-strong)" }}
          >
            <option value="">-- Không qua ví --</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded font-medium cursor-pointer"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {loading ? "..." : "Lưu"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs px-2 py-1.5 text-muted hover:text-foreground cursor-pointer"
        >
          Hủy
        </button>
      </form>
    );
  }

  // mode === "add"
  return (
    <div className="mt-8">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 rounded font-medium transition-colors cursor-pointer"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          + Thêm khoản nợ mới
        </button>
      ) : (
        <div
          className="card bg-elevated animate-fade-in"
          style={{ border: "1px solid var(--border-strong)" }}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Thêm khoản nợ mới</h3>
            <button onClick={() => setIsOpen(false)} className="text-muted hover:text-foreground cursor-pointer">
              ✕
            </button>
          </div>
          <form
            action={async (fd) => {
              setLoading(true);
              await createDebt(fd);
              setLoading(false);
              setIsOpen(false);
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-sm text-muted mb-1">Loại</label>
              <select
                name="direction"
                required
                className="w-full bg-background rounded px-3 py-2 text-foreground focus:outline-none"
                style={{ border: "1px solid var(--border-strong)" }}
              >
                <option value="OWE">Tôi đi vay (Nợ phải trả)</option>
                <option value="OWED">Cho vay (Nợ phải thu)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Tên người / Đối tác</label>
              <input
                type="text"
                name="person"
                required
                placeholder="VD: Nguyễn Văn A"
                className="w-full bg-background rounded px-3 py-2 text-foreground focus:outline-none"
                style={{ border: "1px solid var(--border-strong)" }}
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Số tiền</label>
              <input
                type="number"
                name="amount"
                required
                min="1"
                placeholder="VD: 1000000"
                className="w-full bg-background rounded px-3 py-2 text-foreground focus:outline-none"
                style={{ border: "1px solid var(--border-strong)" }}
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Ngày đến hạn (Tùy chọn)</label>
              <input
                type="date"
                name="dueDate"
                className="w-full bg-background rounded px-3 py-2 text-foreground focus:outline-none"
                style={{ border: "1px solid var(--border-strong)" }}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-muted mb-1">Ghi chú (Tùy chọn)</label>
              <input
                type="text"
                name="note"
                placeholder="Ghi chú thêm..."
                className="w-full bg-background rounded px-3 py-2 text-foreground focus:outline-none"
                style={{ border: "1px solid var(--border-strong)" }}
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded text-muted hover:text-foreground cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 rounded font-medium cursor-pointer"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {loading ? "Đang lưu..." : "Lưu khoản nợ"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
