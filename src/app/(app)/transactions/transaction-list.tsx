"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatCurrency, formatDateTime, toDate } from "@/lib/utils";
import { deleteTransaction } from "@/actions/transactions";
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Edit2,
  Trash2,
  Plus,
  X,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string | null;
}

interface Wallet {
  id: string;
  name: string;
}

interface TransactionItem {
  id: string;
  amount: string | number | { toString: () => string };
  type: "INCOME" | "EXPENSE";
  note?: string | null;
  description?: string | null;
  recordedAt: Date;
  categoryId: string;
  category: Category;
  walletId?: string | null;
  wallet?: Wallet | null;
}

interface Props {
  initialTransactions: TransactionItem[];
  categories: Category[];
  wallets?: Wallet[];
}

export function TransactionList({ initialTransactions, categories }: Props) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedTime, setSelectedTime] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH" | "YEAR">("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return initialTransactions.filter((tx) => {
      // Type filter
      if (selectedType !== "ALL" && tx.type !== selectedType) return false;

      // Category filter
      if (selectedCategory !== "ALL" && tx.categoryId !== selectedCategory) return false;

      // Search filter
      if (search.trim() !== "") {
        const q = search.toLowerCase();
        const desc = (tx.note || tx.description || "").toLowerCase();
        const cat = (tx.category?.name || "").toLowerCase();
        if (!desc.includes(q) && !cat.includes(q)) return false;
      }

      // Time filter
      const txDate = toDate(tx.recordedAt);
      if (selectedTime === "TODAY" && txDate < startOfToday) return false;
      if (selectedTime === "WEEK" && txDate < startOfWeek) return false;
      if (selectedTime === "MONTH" && txDate < startOfMonth) return false;
      if (selectedTime === "YEAR" && txDate < startOfYear) return false;

      return true;
    });
  }, [initialTransactions, search, selectedType, selectedCategory, selectedTime]);

  // Summaries of filtered transactions
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    filtered.forEach((tx) => {
      const amt = Number(tx.amount);
      if (tx.type === "INCOME") income += amt;
      else expense += amt;
    });
    return { income, expense, net: income - expense };
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function handleDelete(id: string, name: string) {
    if (confirm(`Bạn có chắc chắn muốn xóa giao dịch "${name}"?`)) {
      await deleteTransaction(id);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center justify-between border-income/20 bg-income/5">
          <div>
            <p className="text-xs text-muted font-medium uppercase tracking-wider">Thu nhập (Đang lọc)</p>
            <p className="text-xl font-extrabold text-income mt-0.5">+{formatCurrency(summary.income)}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-income/20 flex items-center justify-center text-income">
            <ArrowUpRight size={18} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-expense/20 bg-expense/5">
          <div>
            <p className="text-xs text-muted font-medium uppercase tracking-wider">Chi tiêu (Đang lọc)</p>
            <p className="text-xl font-extrabold text-expense mt-0.5">-{formatCurrency(summary.expense)}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-expense/20 flex items-center justify-center text-expense">
            <ArrowDownLeft size={18} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-border-strong bg-elevated/40">
          <div>
            <p className="text-xs text-muted font-medium uppercase tracking-wider">Số dư ròng</p>
            <p className={`text-xl font-extrabold mt-0.5 ${summary.net >= 0 ? "text-income" : "text-expense"}`}>
              {summary.net > 0 ? "+" : ""}{formatCurrency(summary.net)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-elevated flex items-center justify-center text-muted">
            <CreditCard size={18} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search input */}
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Tìm theo mô tả, ghi chú, danh mục..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 bg-elevated border border-border-strong rounded-lg text-sm outline-none focus:border-primary text-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Time filter */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { key: "ALL", label: "Tất cả" },
              { key: "TODAY", label: "Hôm nay" },
              { key: "WEEK", label: "7 ngày" },
              { key: "MONTH", label: "Tháng này" },
              { key: "YEAR", label: "Năm này" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setSelectedTime(t.key as any);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedTime === t.key
                    ? "bg-primary text-white"
                    : "bg-elevated text-muted hover:text-foreground border border-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Second row of filters: Type & Category */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          {/* Type Toggle */}
          <div className="flex items-center gap-1 bg-elevated p-0.5 rounded-lg border border-border">
            {[
              { key: "ALL", label: "Tất cả loại" },
              { key: "EXPENSE", label: "💸 Chi tiêu" },
              { key: "INCOME", label: "💰 Thu nhập" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setSelectedType(item.key as any);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  selectedType === item.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Danh mục:</span>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="bg-elevated border border-border-strong rounded-lg px-3 py-1 text-xs outline-none focus:border-primary text-foreground"
            >
              <option value="ALL">-- Tất cả danh mục --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transaction List Table */}
      <div className="bg-card border border-border-strong rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-muted text-base font-medium">Không tìm thấy giao dịch nào</p>
            <p className="text-subtle text-xs mt-1">Thử thay đổi bộ lọc hoặc thêm giao dịch mới</p>
            <Link
              href="/transactions/new"
              className="btn-primary mt-4 py-2 px-4 text-xs inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Thêm giao dịch
            </Link>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-12 px-5 py-3 border-b border-border-strong bg-elevated text-xs font-semibold text-muted uppercase tracking-wider">
              <span className="col-span-5 md:col-span-4">Giao dịch / Ghi chú</span>
              <span className="col-span-3 md:col-span-3">Danh mục</span>
              <span className="hidden md:block md:col-span-2">Thời gian</span>
              <span className="col-span-4 md:col-span-3 text-right">Số tiền & Thao tác</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {paginated.map((tx) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-elevated/40 transition-colors group text-sm"
                >
                  {/* Transaction Name & Icon */}
                  <div className="col-span-5 md:col-span-4 flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${tx.category?.color || "#ea580c"}20` }}
                    >
                      {tx.category?.icon ?? "💳"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {tx.note || tx.description || tx.category?.name}
                      </p>
                      <p className="text-xs text-muted truncate md:hidden">
                        {formatDateTime(tx.recordedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Category Pill */}
                  <div className="col-span-3 md:col-span-3">
                    <span
                      className="inline-block text-xs px-2.5 py-0.5 rounded-full font-medium truncate max-w-full"
                      style={{
                        backgroundColor: `${tx.category?.color || "#ea580c"}20`,
                        color: tx.category?.color || "#ea580c",
                        border: `1px solid ${tx.category?.color || "#ea580c"}40`,
                      }}
                    >
                      {tx.category?.name}
                    </span>
                  </div>

                  {/* Time (Desktop) */}
                  <div className="hidden md:block md:col-span-2 text-xs text-muted">
                    {formatDateTime(tx.recordedAt)}
                  </div>

                  {/* Amount & Actions */}
                  <div className="col-span-4 md:col-span-3 flex items-center justify-end gap-3">
                    <div className="flex items-center gap-1">
                      {tx.type === "INCOME" ? (
                        <ArrowUpRight size={14} className="text-income shrink-0" />
                      ) : (
                        <ArrowDownLeft size={14} className="text-expense shrink-0" />
                      )}
                      <span
                        className={`font-bold text-sm ${
                          tx.type === "INCOME" ? "text-income" : "text-expense"
                        }`}
                      >
                        {tx.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(Number(tx.amount))}
                      </span>
                    </div>

                    {/* Action buttons on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/transactions/${tx.id}/edit`}
                        title="Chỉnh sửa"
                        className="p-1 rounded text-muted hover:text-brand hover:bg-elevated transition-colors"
                      >
                        <Edit2 size={13} />
                      </Link>
                      <button
                        onClick={() => handleDelete(tx.id, tx.note || tx.description || tx.category?.name || "giao dịch")}
                        title="Xóa giao dịch"
                        className="p-1 rounded text-muted hover:text-expense hover:bg-expense/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted bg-elevated/30">
                <span>
                  Hiển thị {(page - 1) * pageSize + 1} -{" "}
                  {Math.min(page * pageSize, filtered.length)} trên tổng số {filtered.length} giao dịch
                </span>

                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1.5 rounded bg-elevated border border-border text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-2 font-semibold text-foreground">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-1.5 rounded bg-elevated border border-border text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
