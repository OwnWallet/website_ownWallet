"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { StyledSelect } from "@/components/ui/select";
import {
 AlertDialog,
 AlertDialogContent,
 AlertDialogHeader,
 AlertDialogTitle,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogAction,
 AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
 formatCurrency,
 formatDate,
 formatTime,
 formatDayHeader,
 toDate,
} from "@/lib/utils";
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
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  Clock,
  LayoutList,
  Table as TableIcon,
  Tag,
} from "lucide-react";
import { WalletBadge } from "@/components/ui/wallet-badge";
import type { WalletOption } from "@/components/ui/account-filter";

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
  bankName?: string | null;
  accountNumber?: string | null;
  color?: string | null;
  icon?: string | null;
  txCount?: number;
}

interface TransactionItem {
 id: string;
 amount: string | number | { toString: () => string };
 type: "INCOME" | "EXPENSE";
 note?: string | null;
 description?: string | null;
 recordedAt: any;
 categoryId: string;
 category: Category;
 walletId?: string | null;
 wallet?: Wallet | null;
}

interface Props {
  initialTransactions: TransactionItem[];
  categories: Category[];
  wallets?: Wallet[];
  initialMonth?: number | "ALL";
  initialYear?: number | "ALL";
  initialWallet?: string;
}

export function TransactionList({
  initialTransactions,
  categories,
  wallets = [],
  initialMonth,
  initialYear,
  initialWallet = "ALL",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Time & Wallet filters are controlled uniformly from the Sidebar URL params
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1;
  const currentYearNum = now.getFullYear();

  const selectedMonth = initialMonth !== undefined ? initialMonth : currentMonthNum;
  const selectedYear = initialYear !== undefined ? initialYear : currentYearNum;
  const selectedWallet = initialWallet || "ALL";

  // Sorting
  const [sortOption, setSortOption] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");

  // View Mode: Grouped by day vs Flat Table
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = viewMode === "grouped" ? 7 : 15; // 7 days per page in grouped view, 15 items in table view

  // Filtered & Sorted Transactions
  const filtered = useMemo(() => {
    return initialTransactions
      .filter((tx) => {
        // Account / Wallet filter
        if (selectedWallet !== "ALL") {
          if (selectedWallet === "UNASSIGNED") {
            if (tx.walletId) return false;
          } else {
            if (tx.walletId !== selectedWallet) return false;
          }
        }

        // Type filter
        if (selectedType !== "ALL" && tx.type !== selectedType) return false;

        // Category filter
        if (selectedCategory !== "ALL" && tx.categoryId !== selectedCategory) return false;

        // Search filter (note, description, category name, amount)
        if (search.trim() !== "") {
          const q = search.toLowerCase();
          const desc = (tx.note || tx.description || "").toLowerCase();
          const cat = (tx.category?.name || "").toLowerCase();
          const amtStr = String(Number(tx.amount));
          if (!desc.includes(q) && !cat.includes(q) && !amtStr.includes(q)) return false;
        }

        // Time / Month filters (driven by Sidebar)
        const txDate = toDate(tx.recordedAt);
        if (selectedMonth !== "ALL") {
          if (txDate.getMonth() + 1 !== selectedMonth) return false;
        }
        if (selectedYear !== "ALL") {
          if (txDate.getFullYear() !== selectedYear) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = toDate(a.recordedAt).getTime();
        const dateB = toDate(b.recordedAt).getTime();
        const amtA = Number(a.amount);
        const amtB = Number(b.amount);

        switch (sortOption) {
          case "date-asc":
            return dateA - dateB;
          case "amount-desc":
            return amtB - amtA;
          case "amount-asc":
            return amtA - amtB;
          case "date-desc":
          default:
            return dateB - dateA;
        }
      });
  }, [
    initialTransactions,
    selectedWallet,
    selectedType,
    selectedCategory,
    search,
    selectedMonth,
    selectedYear,
    sortOption,
  ]);

 // Overall Financial Summary for current filter
 const summary = useMemo(() => {
 let income = 0;
 let expense = 0;
 const daysWithExpense = new Set<string>();

 filtered.forEach((tx) => {
 const amt = Number(tx.amount);
 const d = toDate(tx.recordedAt);
 const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

 if (tx.type === "INCOME") {
 income += amt;
 } else {
 expense += amt;
 daysWithExpense.add(dayKey);
 }
 });

 const activeDaysCount = daysWithExpense.size || 1;
 const dailyAvgExpense = Math.round(expense / activeDaysCount);

 return {
 income,
 expense,
 net: income - expense,
 activeDaysCount,
 dailyAvgExpense,
 };
 }, [filtered]);

 // Group transactions by date
 interface DayGroup {
 dateKey: string;
 dateObj: Date;
 dayHeader: { title: string; subtitle: string; isToday: boolean };
 totalExpense: number;
 totalIncome: number;
 netDay: number;
 items: TransactionItem[];
 }

 const groupedDays = useMemo<DayGroup[]>(() => {
 const map = new Map<string, DayGroup>();

 filtered.forEach((tx) => {
 const d = toDate(tx.recordedAt);
 const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

 if (!map.has(dateKey)) {
 map.set(dateKey, {
 dateKey,
 dateObj: d,
 dayHeader: formatDayHeader(d),
 totalExpense: 0,
 totalIncome: 0,
 netDay: 0,
 items: [],
 });
 }

 const group = map.get(dateKey)!;
 const amt = Number(tx.amount);
 if (tx.type === "INCOME") {
 group.totalIncome += amt;
 } else {
 group.totalExpense += amt;
 }
 group.netDay = group.totalIncome - group.totalExpense;
 group.items.push(tx);
 });

 // Sort day groups based on sortOption
 return Array.from(map.values()).sort((a, b) => {
 if (sortOption === "date-asc") {
 return a.dateObj.getTime() - b.dateObj.getTime();
 }
 return b.dateObj.getTime() - a.dateObj.getTime();
 });
 }, [filtered, sortOption]);

 // Pagination calculations
 const totalPages =
 viewMode === "grouped"
 ? Math.ceil(groupedDays.length / pageSize) || 1
 : Math.ceil(filtered.length / pageSize) || 1;

 const paginatedDays = useMemo(() => {
 return groupedDays.slice((page - 1) * pageSize, page * pageSize);
 }, [groupedDays, page, pageSize]);

 const paginatedFlat = useMemo(() => {
 return filtered.slice((page - 1) * pageSize, page * pageSize);
 }, [filtered, page, pageSize]);

 return (
 <div className="space-y-6">
 {/* ─── 1. TOP SUMMARY KPI CARDS ────────────────────────────────── */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
 {/* Thu nhập */}
 <div className="card p-4 flex flex-col justify-between border-emerald-500/20 bg-emerald-500/5">
 <div className="flex items-center justify-between text-muted">
 <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 ">
 Tổng thu nhập
 </span>
 <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600">
 <TrendingUp size={16} />
 </div>
 </div>
 <div className="mt-2">
 <p className="text-lg md:text-2xl font-extrabold text-emerald-600 truncate">
 +{formatCurrency(summary.income)}
 </p>
 <p className="text-[11px] text-muted-foreground mt-0.5">
 {filtered.filter((t) => t.type === "INCOME").length} giao dịch thu
 </p>
 </div>
 </div>

 {/* Chi tiêu */}
 <div className="card p-4 flex flex-col justify-between border-rose-500/20 bg-rose-500/5">
 <div className="flex items-center justify-between text-muted">
 <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 ">
 Tổng chi tiêu
 </span>
 <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-600">
 <TrendingDown size={16} />
 </div>
 </div>
 <div className="mt-2">
 <p className="text-lg md:text-2xl font-extrabold text-rose-600 truncate">
 -{formatCurrency(summary.expense)}
 </p>
 <p className="text-[11px] text-muted-foreground mt-0.5">
 {filtered.filter((t) => t.type === "EXPENSE").length} giao dịch chi
 </p>
 </div>
 </div>

 {/* Số dư ròng */}
 <div className="card p-4 flex flex-col justify-between border-amber-500/20 bg-amber-500/5">
 <div className="flex items-center justify-between text-muted">
 <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 ">
 Dòng tiền ròng
 </span>
 <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600">
 <CreditCard size={16} />
 </div>
 </div>
 <div className="mt-2">
 <p
 className={`text-lg md:text-2xl font-extrabold truncate ${
 summary.net >= 0 ? "text-amber-600 " : "text-rose-600"
 }`}
 >
 {summary.net > 0 ? "+" : ""}
 {formatCurrency(summary.net)}
 </p>
 <p className="text-[11px] text-muted-foreground mt-0.5">
 {summary.net >= 0 ? "Thặng dư tài chính" : "Thâm hụt tài chính"}
 </p>
 </div>
 </div>

 {/* TB Chi tiêu / Ngày */}
 <div className="card p-4 flex flex-col justify-between border-primary/20 bg-primary/5">
 <div className="flex items-center justify-between text-muted">
 <span className="text-xs font-semibold uppercase tracking-wider text-primary">
 TB Chi tiêu / Ngày
 </span>
 <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
 <Clock size={16} />
 </div>
 </div>
 <div className="mt-2">
 <p className="text-lg md:text-2xl font-extrabold text-primary truncate">
 {formatCurrency(summary.dailyAvgExpense)}
 </p>
 <p className="text-[11px] text-muted-foreground mt-0.5">
 Tính trên {summary.activeDaysCount} ngày có chi tiêu
 </p>
 </div>
 </div>
 </div>

      {/* ─── 2. TABLE CONTROLS ─────────────────── */}
      <div className="card p-4 border-border/80 shadow-xs bg-card">
        {/* Search, Type, Category, Sort, and View Mode */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
 {/* Search Bar */}
 <div className="relative flex-1 w-full">
 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
 <input
 type="text"
 placeholder="Tìm theo ghi chú, tên danh mục hoặc số tiền..."
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
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
 >
 <X size={14} />
 </button>
 )}
 </div>

 {/* Type Toggle */}
 <div className="flex items-center gap-1 bg-elevated p-1 rounded-lg border border-border shrink-0">
 {[
 { key: "ALL", label: "Tất cả" },
 { key: "EXPENSE", label: "Chi tiêu" },
 { key: "INCOME", label: "Thu nhập" },
 ].map((item) => (
 <button
 key={item.key}
 onClick={() => {
 setSelectedType(item.key as any);
 setPage(1);
 }}
 className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
 selectedType === item.key
 ? item.key === "EXPENSE"
 ? "bg-rose-500 text-white shadow-xs"
 : item.key === "INCOME"
 ? "bg-emerald-600 text-white shadow-xs"
 : "bg-background text-foreground shadow-xs"
 : "text-muted-foreground hover:text-foreground"
 }`}
 >
 {item.label}
 </button>
 ))}
 </div>

 {/* Category Filter */}
 <div className="w-full md:w-auto shrink-0">
 <StyledSelect
 value={selectedCategory}
 onChange={(val) => {
 setSelectedCategory(val);
 setPage(1);
 }}
 options={[
 { value: "ALL", label: "-- Tất cả danh mục --" },
 ...categories.map((c) => ({
 value: c.id,
 label: `${c.icon || "📂"} ${c.name} (${c.type === "INCOME" ? "Thu" : "Chi"})`,
 })),
 ]}
 className="w-full md:w-56"
 />
 </div>

 {/* Sorting Dropdown */}
 <div className="flex items-center gap-1.5 w-full md:w-auto shrink-0">
 <span className="text-xs text-muted-foreground flex items-center gap-1">
 <ArrowUpDown size={13} /> Sắp xếp:
 </span>
 <StyledSelect
 value={sortOption}
 onChange={(val) => setSortOption(val as any)}
 options={[
 { value: "date-desc", label: "Ngày: Mới nhất trước" },
 { value: "date-asc", label: "Ngày: Cũ nhất trước" },
 { value: "amount-desc", label: "Số tiền: Lớn nhất trước" },
 { value: "amount-asc", label: "Số tiền: Nhỏ nhất trước" },
 ]}
 className="w-48"
 />
 </div>

 {/* View Mode Toggle: Grouped vs Table */}
 <div className="flex items-center gap-1 bg-elevated p-1 rounded-lg border border-border shrink-0">
 <button
 onClick={() => {
 setViewMode("grouped");
 setPage(1);
 }}
 title="Xem nhóm theo ngày & tổng tiền ngày"
 className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
 viewMode === "grouped"
 ? "bg-primary text-primary-foreground shadow-xs"
 : "text-muted-foreground hover:text-foreground"
 }`}
 >
 <LayoutList size={14} />
 <span className="hidden sm:inline">Theo ngày</span>
 </button>
 <button
 onClick={() => {
 setViewMode("table");
 setPage(1);
 }}
 title="Xem danh sách dạng bảng"
 className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
 viewMode === "table"
 ? "bg-primary text-primary-foreground shadow-xs"
 : "text-muted-foreground hover:text-foreground"
 }`}
 >
 <TableIcon size={14} />
 <span className="hidden sm:inline">Dạng bảng</span>
 </button>
 </div>
 </div>
 </div>

 {/* ─── 3. TRANSACTIONS CONTENT ─────────────────────────────────── */}
 {filtered.length === 0 ? (
 <div className="card text-center py-16 px-4 border-dashed">
 <div className="text-4xl mb-3">🔍</div>
 <p className="text-foreground text-base font-bold">Không tìm thấy giao dịch nào</p>
 <p className="text-muted-foreground text-xs mt-1">
 Không có giao dịch nào khớp với bộ lọc tháng hoặc từ khóa hiện tại.
 </p>
 <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setSearch("");
                setSelectedType("ALL");
                setSelectedCategory("ALL");
                const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
                params.delete("wallet");
                router.push(`${pathname}?${params.toString()}`);
              }}
              className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-elevated cursor-pointer"
            >
              Xóa bộ lọc tìm kiếm
            </button>
 <Link href="/transactions/new" className="btn-primary py-1.5 px-3.5 text-xs inline-flex items-center gap-1.5">
 <Plus size={14} /> Thêm giao dịch mới
 </Link>
 </div>
 </div>
 ) : viewMode === "grouped" ? (
 /* ─── VIEW 1: GROUPED BY DAY WITH DAILY TOTALS ────────────── */
 <div className="space-y-4">
 {paginatedDays.map((group) => (
 <div
 key={group.dateKey}
 className="card overflow-hidden border border-border/90 shadow-xs hover:border-primary/40 transition-colors"
 >
 {/* Day Header with Daily Spending & Income Total */}
 <div className="px-4 py-3 bg-slate-50/90 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
 {/* Left: Date info */}
 <div className="flex items-center gap-2.5">
 <div
 className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
 group.dayHeader.isToday
 ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
 : "bg-slate-200 text-foreground"
 }`}
 >
 {group.dateObj.getDate()}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-bold text-foreground">
 {group.dayHeader.title}
 </span>
 {group.dayHeader.isToday && (
 <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
 Hôm nay
 </span>
 )}
 <span className="text-xs text-muted-foreground font-medium">
 {group.dayHeader.subtitle}
 </span>
 </div>
 <p className="text-[11px] text-muted-foreground">
 {group.items.length} giao dịch trong ngày
 </p>
 </div>
 </div>

 {/* Right: Daily Totals (Highlighted) */}
 <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-center">
 {/* Daily Expense Total */}
 {group.totalExpense > 0 && (
 <div className="text-right">
 <span className="text-[10px] uppercase font-bold text-muted-foreground block">
 Tổng tiền chi trong ngày
 </span>
 <span className="text-sm md:text-base font-extrabold text-rose-600 ">
 -{formatCurrency(group.totalExpense)}
 </span>
 </div>
 )}

 {/* Daily Income Total */}
 {group.totalIncome > 0 && (
 <div className="text-right">
 <span className="text-[10px] uppercase font-bold text-muted-foreground block">
 Tổng tiền thu trong ngày
 </span>
 <span className="text-sm md:text-base font-extrabold text-emerald-600 ">
 +{formatCurrency(group.totalIncome)}
 </span>
 </div>
 )}
 </div>
 </div>

 {/* Transactions in this Day */}
 <div className="divide-y divide-border/60">
 {group.items.map((tx) => (
 <div
 key={tx.id}
 className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors group"
 >
 {/* Left: Icon + Description + Category + Time */}
 <div className="flex items-center gap-3 min-w-0 flex-1">
 {/* Category Icon */}
 <div
 className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border border-border/60"
 style={{ backgroundColor: `${tx.category?.color || "#ea580c"}18` }}
 >
 {tx.category?.icon ?? "💳"}
 </div>

 {/* Info */}
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <p className="font-bold text-sm text-foreground truncate">
 {tx.note || tx.description || tx.category?.name || "Giao dịch"}
 </p>
 {/* Type indicator badge */}
 <span
 className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
 tx.type === "INCOME"
 ? "bg-emerald-100 text-emerald-800 "
 : "bg-rose-100 text-rose-800 "
 }`}
 >
 {tx.type === "INCOME" ? "Thu nhập" : "Chi tiêu"}
 </span>
 </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        {/* Category Tag */}
                        <span
                          className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full text-[11px]"
                          style={{
                            backgroundColor: `${tx.category?.color || "#ea580c"}15`,
                            color: tx.category?.color || "#ea580c",
                            border: `1px solid ${tx.category?.color || "#ea580c"}30`,
                          }}
                        >
                          <Tag size={10} />
                          {tx.category?.name}
                        </span>

                        {/* Wallet Badge */}
                        {tx.wallet && (
                          <>
                            <span>•</span>
                            <WalletBadge
                              wallet={tx.wallet}
                              size="sm"
                            />
                          </>
                        )}

                        <span>•</span>

                        {/* Time */}
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock size={11} />
                          {formatTime(tx.recordedAt)}
                        </span>
                      </div>
 </div>
 </div>

 {/* Right: Amount & Actions */}
 <div className="flex items-center gap-3 shrink-0">
 {/* Amount */}
 <div className="text-right">
 <span
 className={`text-sm md:text-base font-extrabold ${
 tx.type === "INCOME" ? "text-emerald-600" : "text-rose-600"
 }`}
 >
 {tx.type === "INCOME" ? "+" : "-"}
 {formatCurrency(Number(tx.amount))}
 </span>
 </div>

 {/* Edit / Delete Buttons */}
 <div className="flex items-center gap-1">
 <Link
 href={`/transactions/${tx.id}/edit`}
 title="Chỉnh sửa giao dịch"
 className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-elevated transition-colors"
 >
 <Edit2 size={14} />
 </Link>
 <button
 onClick={() =>
 setDeleteTarget({
 id: tx.id,
 name: tx.note || tx.description || tx.category?.name || "giao dịch",
 })
 }
 title="Xóa giao dịch"
 className="p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
 >
 <Trash2 size={14} />
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 ) : (
 /* ─── VIEW 2: FLAT TABLE VIEW ──────────────────────────────── */
 <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
 {/* Table Header */}
 <div className="grid grid-cols-12 px-4 py-3 border-b border-border bg-slate-50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
 <span className="col-span-5 md:col-span-4">Giao dịch / Ghi chú</span>
 <span className="col-span-3 md:col-span-3">Danh mục</span>
 <span className="hidden md:block md:col-span-2">Ngày & Giờ</span>
 <span className="col-span-4 md:col-span-3 text-right">Số tiền & Thao tác</span>
 </div>

 {/* Table Rows */}
 <div className="divide-y divide-border/70">
 {paginatedFlat.map((tx) => (
 <div
 key={tx.id}
 className="grid grid-cols-12 px-4 py-3.5 items-center hover:bg-slate-50/70 transition-colors group text-sm"
 >
 {/* Transaction Name & Icon */}
 <div className="col-span-5 md:col-span-4 flex items-center gap-3 min-w-0 pr-2">
 <div
 className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 border border-border/60"
 style={{ backgroundColor: `${tx.category?.color || "#ea580c"}20` }}
 >
 {tx.category?.icon ?? "💳"}
 </div>
 <div className="min-w-0">
 <p className="font-bold text-foreground truncate">
 {tx.note || tx.description || tx.category?.name}
 </p>
 <p className="text-xs text-muted-foreground truncate md:hidden">
 {formatDate(tx.recordedAt)} · {formatTime(tx.recordedAt)}
 </p>
 </div>
 </div>

                  {/* Category & Wallet Pill */}
                  <div className="col-span-3 md:col-span-3 flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-block text-xs px-2.5 py-0.5 rounded-full font-semibold truncate max-w-full"
                      style={{
                        backgroundColor: `${tx.category?.color || "#ea580c"}15`,
                        color: tx.category?.color || "#ea580c",
                        border: `1px solid ${tx.category?.color || "#ea580c"}30`,
                      }}
                    >
                      {tx.category?.name}
                    </span>
                    {tx.wallet && (
                      <WalletBadge
                        wallet={tx.wallet}
                        size="sm"
                      />
                    )}
                  </div>

 {/* Date & Time (Desktop) */}
 <div className="hidden md:block md:col-span-2 text-xs text-muted-foreground">
 <span className="font-medium text-foreground block">{formatDate(tx.recordedAt)}</span>
 <span>{formatTime(tx.recordedAt)}</span>
 </div>

 {/* Amount & Actions */}
 <div className="col-span-4 md:col-span-3 flex items-center justify-end gap-3">
 <div className="flex items-center gap-1.5">
 {tx.type === "INCOME" ? (
 <ArrowUpRight size={15} className="text-emerald-600 shrink-0" />
 ) : (
 <ArrowDownLeft size={15} className="text-rose-600 shrink-0" />
 )}
 <span
 className={`font-extrabold text-sm md:text-base ${
 tx.type === "INCOME" ? "text-emerald-600" : "text-rose-600"
 }`}
 >
 {tx.type === "INCOME" ? "+" : "-"}
 {formatCurrency(Number(tx.amount))}
 </span>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-1">
 <Link
 href={`/transactions/${tx.id}/edit`}
 title="Chỉnh sửa"
 className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-elevated transition-colors"
 >
 <Edit2 size={13} />
 </Link>
 <button
 onClick={() =>
 setDeleteTarget({
 id: tx.id,
 name: tx.note || tx.description || tx.category?.name || "giao dịch",
 })
 }
 title="Xóa giao dịch"
 className="p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
 >
 <Trash2 size={13} />
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* ─── 4. PAGINATION CONTROLS ─────────────────────────────────── */}
 {totalPages > 1 && (
 <div className="card p-3.5 border-border flex items-center justify-between text-xs text-muted-foreground bg-card">
 <span>
 {viewMode === "grouped" ? (
 <>
 Hiển thị ngày {(page - 1) * pageSize + 1} -{" "}
 {Math.min(page * pageSize, groupedDays.length)} trên tổng số {groupedDays.length} ngày
 </>
 ) : (
 <>
 Hiển thị giao dịch {(page - 1) * pageSize + 1} -{" "}
 {Math.min(page * pageSize, filtered.length)} trên tổng số {filtered.length} giao dịch
 </>
 )}
 </span>

 <div className="flex items-center gap-1.5">
 <button
 disabled={page === 1}
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 className="p-1.5 rounded-md bg-elevated border border-border text-foreground hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
 >
 <ChevronLeft size={16} />
 </button>
 <span className="px-3 py-1 font-bold text-foreground bg-primary/10 rounded-md border border-primary/20">
 Trang {page} / {totalPages}
 </span>
 <button
 disabled={page === totalPages}
 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
 className="p-1.5 rounded-md bg-elevated border border-border text-foreground hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
 >
 <ChevronRight size={16} />
 </button>
 </div>
 </div>
 )}

 <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Xác nhận xóa giao dịch</AlertDialogTitle>
 <AlertDialogDescription>
 Bạn có chắc chắn muốn xóa giao dịch &ldquo;{deleteTarget?.name}&rdquo;? Hành động này không thể hoàn tác.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
 Hủy bỏ
 </AlertDialogCancel>
 <AlertDialogAction
 onClick={async () => {
 if (deleteTarget) {
 await deleteTransaction(deleteTarget.id);
 toast.success("Đã xóa giao dịch thành công");
 setDeleteTarget(null);
 }
 }}
 >
 Xóa giao dịch
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}
