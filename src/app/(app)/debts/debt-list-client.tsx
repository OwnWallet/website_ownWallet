"use client";

import { useState, useRef, useMemo, useSyncExternalStore } from "react";
import {
  TrendingDown,
  TrendingUp,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Columns2,
  LayoutList,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { DebtCard } from "./debt-card";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { deleteDebts } from "@/actions/debts";
import { toDate } from "@/lib/utils";

interface DebtListClientProps {
  owes: any[];
  oweds: any[];
  wallets?: any[];
}

type ViewMode = "tabs" | "split";
type StatusFilter = "ALL" | "PENDING" | "PARTIAL" | "OVERDUE";
type PriorityFilter = "ALL" | "HIGH";

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "tabs";
  try {
    const saved = localStorage.getItem("ownwallet_debt_view_mode");
    if (saved === "tabs" || saved === "split") return saved as ViewMode;
  } catch {
    // Ignore
  }
  return "tabs";
}

interface DebtPanelProps {
  type: "OWE" | "OWED";
  list: any[];
  paginatedList: any[];
  page: number;
  totalPages: number;
  pageSize: number;
  setPageSize: (size: number) => void;
  onPageChange: (newPage: number) => void;
  isFilterActive: boolean;
  clearAllFilters: () => void;
  wallets: any[];
  selectedIds: Set<string>;
  toggleSelectOne: (id: string) => void;
  onToggleSelectAll: () => void;
}

function DebtPanel({
  type,
  list,
  paginatedList,
  page,
  totalPages,
  pageSize,
  setPageSize,
  onPageChange,
  isFilterActive,
  clearAllFilters,
  wallets,
  selectedIds,
  toggleSelectOne,
  onToggleSelectAll,
}: DebtPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isOwe = type === "OWE";
  const title = isOwe ? "Tôi nợ" : "Người nợ tôi";
  const allSelected = list.length > 0 && list.every((d) => selectedIds.has(d.id));

  const handlePageChange = (p: number) => {
    onPageChange(p);
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, list.length);

  return (
    <div className="flex flex-col bg-card/60 rounded-2xl border border-border/80 p-3 sm:p-4 shadow-2xs">
      {/* Sticky Panel Header inside Column */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-xs pb-3 mb-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              isOwe ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
            }`}
          >
            {isOwe ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
          </div>
          <h3 className="text-sm sm:text-base font-bold text-foreground">
            {title} <span className="text-muted-foreground font-normal text-xs ml-1">({list.length})</span>
          </h3>
        </div>

        {list.length > 0 && (
          <button
            type="button"
            onClick={onToggleSelectAll}
            className={`text-xs font-semibold hover:underline cursor-pointer transition-colors ${
              isOwe ? "text-rose-600 hover:text-rose-700" : "text-emerald-600 hover:text-emerald-700"
            }`}
          >
            {allSelected ? "Bỏ chọn nhóm này" : "Chọn tất cả nhóm này"}
          </button>
        )}
      </div>

      {/* Independent Scroll Container (max-h-[560px]) */}
      <div
        ref={containerRef}
        className="max-h-[560px] overflow-y-auto pr-1.5 space-y-3 scrollbar-thin scroll-smooth"
      >
        {list.length === 0 ? (
          <div className="empty-state py-10 my-4 border border-dashed border-border rounded-xl">
            <span className="empty-state-icon">{isFilterActive ? "🔍" : isOwe ? "😌" : "🪹"}</span>
            <p className="empty-state-title text-sm">
              {isFilterActive
                ? "Không tìm thấy khoản nợ nào khớp"
                : isOwe
                ? "Bạn không có khoản nợ nào cần trả"
                : "Không có ai đang nợ tiền bạn"}
            </p>
            {isFilterActive && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Xóa bộ lọc để xem tất cả
              </button>
            )}
          </div>
        ) : (
          paginatedList.map((d: any) => (
            <DebtCard
              key={d.id}
              debt={d}
              wallets={wallets}
              selected={selectedIds.has(d.id)}
              onToggleSelect={() => toggleSelectOne(d.id)}
            />
          ))
        )}
      </div>

      {/* Pagination at bottom of Panel */}
      {list.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 bg-card border border-border rounded-xl text-xs text-muted-foreground shadow-2xs mt-3">
          <span>
            {pageSize >= 999 ? (
              <>Hiển thị tất cả <strong>{list.length}</strong> khoản nợ</>
            ) : (
              <>
                Hiển thị <strong>{startItem} - {endItem}</strong> trên <strong>{list.length}</strong> khoản nợ
              </>
            )}
          </span>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span>Mỗi trang:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-background rounded-md px-2 py-0.5 border border-border text-foreground font-medium focus:outline-none cursor-pointer"
              >
                <option value={4}>4</option>
                <option value={6}>6</option>
                <option value={10}>10</option>
                <option value={999}>Tất cả</option>
              </select>
            </div>

            {totalPages > 1 && pageSize < 999 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="p-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Trang trước"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="px-2.5 py-1 text-[11px] font-bold bg-primary/10 text-primary rounded-lg border border-primary/20">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="p-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Trang sau"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DebtListClient({ owes, oweds, wallets = [] }: DebtListClientProps) {
  // ─── 1. View & Tab State ─────────────────────────────────────
  const storedViewMode = useSyncExternalStore(
    subscribeStorage,
    getStoredViewMode,
    () => "tabs" as ViewMode
  );
  const [userViewMode, setUserViewMode] = useState<ViewMode | null>(null);
  const viewMode = userViewMode ?? storedViewMode;
  const [activeTab, setActiveTab] = useState<"OWE" | "OWED">("OWE");

  const changeViewMode = (mode: ViewMode) => {
    setUserViewMode(mode);
    try {
      localStorage.setItem("ownwallet_debt_view_mode", mode);
    } catch {
      // Ignore
    }
  };

  // ─── 2. Search & Filter State ────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");

  // ─── 3. Pagination State ─────────────────────────────────────
  const [pageSize, setPageSize] = useState<number>(6);
  const [pageOwe, setPageOwe] = useState(1);
  const [pageOwed, setPageOwed] = useState(1);

  // Handlers that update filters and reset pagination directly in user actions
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPageOwe(1);
    setPageOwed(1);
  };

  const handleStatusFilterChange = (st: StatusFilter) => {
    setStatusFilter(st);
    setPageOwe(1);
    setPageOwed(1);
  };

  const handlePriorityFilterToggle = () => {
    setPriorityFilter((prev) => (prev === "HIGH" ? "ALL" : "HIGH"));
    setPageOwe(1);
    setPageOwed(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPageOwe(1);
    setPageOwed(1);
  };

  const isFilterActive = searchQuery.trim() !== "" || statusFilter !== "ALL" || priorityFilter !== "ALL";

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setPageOwe(1);
    setPageOwed(1);
  };

  // ─── 4. Bulk Selection State ─────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── 5. Filter Helpers ───────────────────────────────────────
  const filterList = (list: any[]) => {
    return list.filter((d) => {
      // Search text filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const personMatch = d.person?.toLowerCase().includes(q);
        const noteMatch = d.note?.toLowerCase().includes(q);
        if (!personMatch && !noteMatch) return false;
      }

      // Status filter
      if (statusFilter === "PENDING" && d.status !== "PENDING") return false;
      if (statusFilter === "PARTIAL" && d.status !== "PARTIAL") return false;
      if (statusFilter === "OVERDUE") {
        const isOverdue = d.dueDate && toDate(d.dueDate) < new Date() && d.status !== "PAID";
        if (!isOverdue) return false;
      }

      // Priority filter
      if (priorityFilter === "HIGH" && d.priority !== "HIGH") return false;

      return true;
    });
  };

  const filteredOwes = useMemo(
    () => filterList(owes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owes, searchQuery, statusFilter, priorityFilter]
  );

  const filteredOweds = useMemo(
    () => filterList(oweds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oweds, searchQuery, statusFilter, priorityFilter]
  );

  // ─── 6. Pagination Slices & Clamped Pages ─────────────────────
  const totalOwePages = Math.max(1, Math.ceil(filteredOwes.length / pageSize));
  const safePageOwe = Math.min(Math.max(1, pageOwe), totalOwePages);
  const paginatedOwes = useMemo(() => {
    if (pageSize >= 999) return filteredOwes;
    const start = (safePageOwe - 1) * pageSize;
    return filteredOwes.slice(start, start + pageSize);
  }, [filteredOwes, safePageOwe, pageSize]);

  const totalOwedPages = Math.max(1, Math.ceil(filteredOweds.length / pageSize));
  const safePageOwed = Math.min(Math.max(1, pageOwed), totalOwedPages);
  const paginatedOweds = useMemo(() => {
    if (pageSize >= 999) return filteredOweds;
    const start = (safePageOwed - 1) * pageSize;
    return filteredOweds.slice(start, start + pageSize);
  }, [filteredOweds, safePageOwed, pageSize]);

  // Toggle selection for all visible/filtered items
  const toggleSelectAllOwes = () => {
    const ids = filteredOwes.map((d) => d.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectAllOweds = () => {
    const ids = filteredOweds.map((d) => d.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // ─── 7. Render Sub-Components ────────────────────────────────

  // Toolbar (Search, Filter, View Switcher)
  const renderToolbar = () => (
    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-2xs space-y-3">
      {/* Row 1: Mode Switcher / Tab Switcher & View Mode */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tab Switcher (Visible in 'tabs' mode) */}
        {viewMode === "tabs" ? (
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-border shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("OWE")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "OWE"
                  ? "bg-white dark:bg-slate-900 text-rose-600 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingDown size={14} className="text-rose-600" />
              <span>Tôi nợ</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === "OWE" ? "bg-rose-100 text-rose-700 font-extrabold" : "bg-slate-200 text-slate-600"
                }`}
              >
                {filteredOwes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("OWED")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "OWED"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp size={14} className="text-emerald-600" />
              <span>Người nợ tôi</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === "OWED"
                    ? "bg-emerald-100 text-emerald-700 font-extrabold"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {filteredOweds.length}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <span>Chế độ xem 2 cột song song</span>
            <span className="text-muted-foreground font-normal text-xs">
              ({filteredOwes.length} phải trả &bull; {filteredOweds.length} phải thu)
            </span>
          </div>
        )}

        {/* View Mode Toggle Button (Tabs vs Split) */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => changeViewMode("tabs")}
              title="Xem lần lượt từng nhóm nợ (Gọn gàng, tối ưu)"
              className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "tabs"
                  ? "bg-white dark:bg-slate-900 text-primary shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList size={14} />
              <span className="hidden sm:inline">Theo Tab</span>
            </button>
            <button
              type="button"
              onClick={() => changeViewMode("split")}
              title="Xem 2 nhóm nợ song song cùng lúc (Có khung cuộn riêng)"
              className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "split"
                  ? "bg-white dark:bg-slate-900 text-primary shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Columns2 size={14} />
              <span className="hidden sm:inline">2 Cột</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Search Input & Quick Filter Chips */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border/70">
        {/* Live Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm theo tên người, ghi chú khoản nợ..."
            className="w-full bg-background rounded-xl pl-8.5 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Status Filter */}
          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-border/80">
            {(
              [
                { label: "Tất cả", value: "ALL" },
                { label: "Chờ trả", value: "PENDING" },
                { label: "Trả 1 phần", value: "PARTIAL" },
                { label: "Quá hạn", value: "OVERDUE" },
              ] as const
            ).map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => handleStatusFilterChange(st.value)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  statusFilter === st.value
                    ? "bg-white dark:bg-slate-900 text-primary font-bold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Priority High Toggle */}
          <button
            type="button"
            onClick={handlePriorityFilterToggle}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              priorityFilter === "HIGH"
                ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50"
                : "bg-background border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            🔴 Ưu tiên cao
          </button>

          {/* Reset Filters */}
          {isFilterActive && (
            <button
              type="button"
              onClick={clearAllFilters}
              title="Đặt lại bộ lọc"
              className="p-1 px-2 text-[11px] font-medium text-muted-foreground hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw size={12} />
              <span>Xóa lọc</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in w-full">
      {/* Search & Filter Toolbar */}
      {renderToolbar()}

      {/* Main Content Area */}
      {viewMode === "tabs" ? (
        // Tabs Mode
        <div>
          {activeTab === "OWE" ? (
            <DebtPanel
              type="OWE"
              list={filteredOwes}
              paginatedList={paginatedOwes}
              page={safePageOwe}
              totalPages={totalOwePages}
              pageSize={pageSize}
              setPageSize={handlePageSizeChange}
              onPageChange={setPageOwe}
              isFilterActive={isFilterActive}
              clearAllFilters={clearAllFilters}
              wallets={wallets}
              selectedIds={selectedIds}
              toggleSelectOne={toggleSelectOne}
              onToggleSelectAll={toggleSelectAllOwes}
            />
          ) : (
            <DebtPanel
              type="OWED"
              list={filteredOweds}
              paginatedList={paginatedOweds}
              page={safePageOwed}
              totalPages={totalOwedPages}
              pageSize={pageSize}
              setPageSize={handlePageSizeChange}
              onPageChange={setPageOwed}
              isFilterActive={isFilterActive}
              clearAllFilters={clearAllFilters}
              wallets={wallets}
              selectedIds={selectedIds}
              toggleSelectOne={toggleSelectOne}
              onToggleSelectAll={toggleSelectAllOweds}
            />
          )}
        </div>
      ) : (
        // Split 2-Column Mode
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <DebtPanel
            type="OWE"
            list={filteredOwes}
            paginatedList={paginatedOwes}
            page={safePageOwe}
            totalPages={totalOwePages}
            pageSize={pageSize}
            setPageSize={handlePageSizeChange}
            onPageChange={setPageOwe}
            isFilterActive={isFilterActive}
            clearAllFilters={clearAllFilters}
            wallets={wallets}
            selectedIds={selectedIds}
            toggleSelectOne={toggleSelectOne}
            onToggleSelectAll={toggleSelectAllOwes}
          />

          <DebtPanel
            type="OWED"
            list={filteredOweds}
            paginatedList={paginatedOweds}
            page={safePageOwed}
            totalPages={totalOwedPages}
            pageSize={pageSize}
            setPageSize={handlePageSizeChange}
            onPageChange={setPageOwed}
            isFilterActive={isFilterActive}
            clearAllFilters={clearAllFilters}
            wallets={wallets}
            selectedIds={selectedIds}
            toggleSelectOne={toggleSelectOne}
            onToggleSelectAll={toggleSelectAllOweds}
          />
        </div>
      )}

      {/* Bulk Action Bar (fixed at bottom when items selected) */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        itemName="khoản nợ"
        onClearSelection={() => setSelectedIds(new Set())}
        onConfirmDelete={async () => {
          const res = await deleteDebts(Array.from(selectedIds));
          if ((res as any)?.error) {
            toast.error((res as any).error);
          } else {
            toast.success(`Đã xóa thành công ${res.count ?? selectedIds.size} khoản nợ`);
            setSelectedIds(new Set());
          }
        }}
      />
    </div>
  );
}
