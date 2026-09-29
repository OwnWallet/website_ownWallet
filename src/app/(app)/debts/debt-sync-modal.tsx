"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  UserPlus,
  Layers,
  ShieldCheck,
  X,
  AlertTriangle,
  Unlink,
} from "lucide-react";
import { getDebtSyncCandidates, syncTransactionsToDebts, unlinkTxFromDebts } from "@/actions/debts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface Candidate {
  txId: string;
  amount: number;
  recordedAt: string;
  type: "INCOME" | "EXPENSE";
  categoryName: string;
  categoryType: string;
  note: string;
  person: string;
  direction: "OWE" | "OWED";
  isDuplicate: boolean;
  actionType: "MERGE" | "CREATE" | "DUPLICATE";
  targetDebtId?: string;
  targetDebtPerson?: string;
  targetDebtCurrentAmount?: number;
  targetDebtNewAmount?: number;
  // BUG-3: Flag cảnh báo khi tên người là fallback heuristic
  personIsFallback: boolean;
}

interface Summary {
  totalFound: number;
  toCreateCount: number;
  toMergeCount: number;
  duplicateCount: number;
  toCreateAmount: number;
  toMergeAmount: number;
  totalActionableAmount: number;
  // BUG-5: Cờ báo hiệu kết quả bị giới hạn
  isLimited?: boolean;
}

export function DebtSyncModal({ triggerButton }: { triggerButton?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"actionable" | "create" | "merge" | "duplicate" | "all">("actionable");
  const mounted = useMounted();

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const res = await getDebtSyncCandidates();
      setCandidates(res.candidates);
      setSummary(res.summary);

      // Mặc định chọn tất cả các giao dịch hợp lệ (không trùng lặp, không phải fallback tên)
      const actionableIds = new Set(
        res.candidates
          .filter((c) => c.actionType !== "DUPLICATE" && !c.personIsFallback)
          .map((c) => c.txId)
      );
      setSelectedTxIds(actionableIds);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách giao dịch cần đồng bộ");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    loadCandidates();
  };

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const toggleSelectOne = (txId: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  const toggleSelectAllActionable = () => {
    const actionable = candidates.filter((c) => c.actionType !== "DUPLICATE");
    const allSelected = actionable.length > 0 && actionable.every((c) => selectedTxIds.has(c.txId));
    if (allSelected) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(actionable.map((c) => c.txId)));
    }
  };

  const handleConfirmSync = async () => {
    const idsToSync = Array.from(selectedTxIds);
    if (idsToSync.length === 0) {
      toast.warning("Vui lòng chọn ít nhất một giao dịch để đồng bộ");
      return;
    }

    setSubmitting(true);
    try {
      const res = await syncTransactionsToDebts(idsToSync);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `Đã đồng bộ thành công! Tạo mới ${res.createdCount} khoản nợ, gộp vào ${res.mergedCount} nợ cũ.`,
          { duration: 4500 }
        );
        setIsOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Đã xảy ra lỗi khi thực hiện đồng bộ vào sổ nợ");
    } finally {
      setSubmitting(false);
    }
  };

  // BUG-6: Hủy liên kết đồng bộ cho một giao dịch đã sync
  const handleUnlink = async (txId: string) => {
    setUnlinkingId(txId);
    try {
      const res = await unlinkTxFromDebts(txId);
      if (res?.success) {
        toast.success("Đã hủy liên kết. Giao dịch có thể được đồng bộ lại.", { duration: 3500 });
        await loadCandidates();
      } else {
        toast.error("Không thể hủy liên kết");
      }
    } catch (err) {
      console.error(err);
      toast.error("Đã xảy ra lỗi khi hủy liên kết");
    } finally {
      setUnlinkingId(null);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (activeTab === "actionable") return c.actionType !== "DUPLICATE";
    if (activeTab === "create") return c.actionType === "CREATE";
    if (activeTab === "merge") return c.actionType === "MERGE";
    if (activeTab === "duplicate") return c.actionType === "DUPLICATE";
    return true;
  });

  const actionableList = candidates.filter((c) => c.actionType !== "DUPLICATE");
  const selectedCount = Array.from(selectedTxIds).filter((id) =>
    actionableList.some((c) => c.txId === id)
  ).length;

  // BUG-3: Đếm số giao dịch có tên person là fallback
  const fallbackCount = actionableList.filter((c) => c.personIsFallback).length;

  return (
    <>
      {triggerButton ? (
        <div onClick={handleOpen} className="inline-block">
          {triggerButton}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center gap-2 border border-border bg-card hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground active:scale-95"
          title="Đồng bộ các giao dịch danh mục Vay & Cho vay vào sổ nợ"
        >
          <RefreshCw size={14} className="text-amber-500 shrink-0" />
          <span>Đồng bộ từ giao dịch</span>
        </button>
      )}

      {mounted && isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-card border border-border shadow-2xl rounded-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-scale-in text-foreground"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/25">
                  <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                    <span>Đồng bộ giao dịch Vay & Cho vay</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tự động đối chiếu với Sổ nợ: loại bỏ trùng lặp, thêm mới hoặc cộng dồn vào nợ cũ
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                  <RefreshCw size={28} className="animate-spin text-amber-500" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Đang quét các giao dịch Vay & Cho vay và đối chiếu với Sổ nợ...
                  </p>
                </div>
              ) : summary?.totalFound === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-muted-foreground flex items-center justify-center text-xl">
                    🔍
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Chưa có giao dịch Vay hoặc Cho vay</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mt-1">
                      Hãy tạo giao dịch với danh mục &quot;Vay&quot;, &quot;Cho vay&quot; hoặc danh mục loại Nợ trong trang Giao dịch để đồng bộ vào đây.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* BUG-5: Cảnh báo nếu kết quả bị giới hạn */}
                  {summary?.isLimited && (
                    <div className="p-3 rounded-xl border border-orange-400/30 bg-orange-500/8 flex items-start gap-2 text-xs text-orange-700 dark:text-orange-400">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        <strong>Lưu ý:</strong> Hệ thống chỉ quét 2,000 giao dịch gần nhất. Các giao dịch cũ hơn có thể chưa được hiển thị.
                      </span>
                    </div>
                  )}

                  {/* BUG-3: Cảnh báo khi có giao dịch không rõ tên người */}
                  {fallbackCount > 0 && (
                    <div className="p-3 rounded-xl border border-yellow-400/30 bg-yellow-500/8 flex items-start gap-2 text-xs text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Cảnh báo:</span>{" "}
                        <span>
                          {fallbackCount} giao dịch không có tên người rõ ràng — tên được đoán từ nội dung ghi chú và có thể không chính xác. Những giao dịch này <strong>không được chọn mặc định</strong>. Hãy kiểm tra kỹ trước khi đồng bộ, hoặc thêm ghi chú dạng <code className="bg-yellow-500/15 px-1 rounded">[Người: Tên]</code> vào giao dịch để tăng độ chính xác.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Thêm mới */}
                    <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-600">
                        <span className="flex items-center gap-1.5">
                          <UserPlus size={14} /> Thêm mới
                        </span>
                        <span className="text-sm font-bold">{summary?.toCreateCount ?? 0}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Chưa trùng người sở hữu ({formatCurrency(summary?.toCreateAmount ?? 0)})
                      </p>
                    </div>

                    {/* Gộp nợ cũ */}
                    <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-amber-600">
                        <span className="flex items-center gap-1.5">
                          <Layers size={14} /> Gộp nợ cũ
                        </span>
                        <span className="text-sm font-bold">{summary?.toMergeCount ?? 0}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Cộng thêm vào người đã có ({formatCurrency(summary?.toMergeAmount ?? 0)})
                      </p>
                    </div>

                    {/* Trùng lặp */}
                    <div className="p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-800/40 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck size={14} /> Trùng lặp
                        </span>
                        <span className="text-sm font-bold">{summary?.duplicateCount ?? 0}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Đã có trong sổ nợ (tự động loại bỏ)
                      </p>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2 flex-wrap text-xs">
                    <div className="flex items-center gap-1 overflow-x-auto py-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab("actionable")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          activeTab === "actionable"
                            ? "bg-primary text-white font-bold"
                            : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Cần đồng bộ ({actionableList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("create")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          activeTab === "create"
                            ? "bg-emerald-600 text-white font-bold"
                            : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Mới ({summary?.toCreateCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("merge")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          activeTab === "merge"
                            ? "bg-amber-600 text-white font-bold"
                            : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Gộp ({summary?.toMergeCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("duplicate")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          activeTab === "duplicate"
                            ? "bg-slate-700 text-white font-bold"
                            : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Trùng lặp ({summary?.duplicateCount})
                      </button>
                    </div>

                    {actionableList.length > 0 && activeTab !== "duplicate" && (
                      <button
                        type="button"
                        onClick={toggleSelectAllActionable}
                        className="text-[11px] font-semibold text-primary hover:underline cursor-pointer transition-colors"
                      >
                        {actionableList.every((c) => selectedTxIds.has(c.txId))
                          ? "Bỏ chọn tất cả"
                          : "Chọn tất cả"}
                      </button>
                    )}
                  </div>

                  {/* Candidate List */}
                  <div className="space-y-2">
                    {filteredCandidates.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Không có giao dịch nào trong mục này.
                      </div>
                    ) : (
                      filteredCandidates.map((c) => {
                        const isSelected = selectedTxIds.has(c.txId);
                        const isDup = c.actionType === "DUPLICATE";
                        const isMerge = c.actionType === "MERGE";
                        const isUnlinking = unlinkingId === c.txId;

                        return (
                          <div
                            key={c.txId}
                            onClick={() => !isDup && toggleSelectOne(c.txId)}
                            className={`p-3 rounded-xl border transition-all flex items-start gap-3 text-xs ${
                              isDup
                                ? "opacity-70 bg-slate-50 dark:bg-slate-900/40 border-border cursor-default"
                                : c.personIsFallback
                                ? isSelected
                                  ? "border-yellow-400/60 bg-yellow-400/8 cursor-pointer"
                                  : "border-yellow-400/30 bg-yellow-400/5 hover:border-yellow-400/50 cursor-pointer"
                                : isSelected
                                ? "border-primary/50 bg-primary/5 cursor-pointer shadow-2xs"
                                : "border-border hover:border-border-strong cursor-pointer bg-card"
                            }`}
                          >
                            {!isDup && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                              />
                            )}
                            {isDup && (
                              <div className="mt-1 w-4 h-4 shrink-0" />
                            )}

                            <div className="flex-1 min-w-0 space-y-1">
                              {/* Top row: Person & Amount */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-foreground">
                                    {c.person}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      c.direction === "OWE"
                                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                                        : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                    }`}
                                  >
                                    {c.direction === "OWE" ? "Tôi đi vay" : "Cho vay"}
                                  </span>
                                  {/* BUG-3: Badge cảnh báo tên fallback */}
                                  {c.personIsFallback && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-800 flex items-center gap-1">
                                      <AlertTriangle size={10} />
                                      Tên chưa chắc chắn
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-sm text-foreground">
                                  {formatCurrency(c.amount)}
                                </span>
                              </div>

                              {/* BUG-3: Gợi ý khi tên là fallback */}
                              {c.personIsFallback && !isDup && (
                                <div className="p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[11px] text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                                  <AlertTriangle size={11} />
                                  <span>
                                    Tên được đoán từ ghi chú. Thêm{" "}
                                    <code className="bg-yellow-500/15 px-0.5 rounded">[Người: Tên]</code>{" "}
                                    vào ghi chú giao dịch để chính xác hơn.
                                  </span>
                                </div>
                              )}

                              {/* Details: Action description */}
                              {isMerge ? (
                                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 flex items-center justify-between flex-wrap gap-1">
                                  <span className="flex items-center gap-1 font-semibold">
                                    <Layers size={13} /> Trùng người sở hữu → Cộng thêm vào nợ cũ
                                  </span>
                                  <span className="font-medium">
                                    {formatCurrency(c.targetDebtCurrentAmount || 0)} <ArrowRight size={11} className="inline mx-0.5" /> <strong>{formatCurrency(c.targetDebtNewAmount || 0)}</strong>
                                  </span>
                                </div>
                              ) : isDup ? (
                                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1">
                                    <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                                    <span>Đã được đồng bộ trước đó. Tự động loại bỏ để tránh trùng lặp.</span>
                                  </div>
                                  {/* BUG-6: Nút hủy liên kết để có thể re-sync */}
                                  <button
                                    type="button"
                                    disabled={isUnlinking}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnlink(c.txId);
                                    }}
                                    className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-300/40 dark:border-rose-700/40 transition-colors cursor-pointer"
                                    title="Hủy liên kết để đồng bộ lại"
                                  >
                                    {isUnlinking ? (
                                      <RefreshCw size={10} className="animate-spin" />
                                    ) : (
                                      <Unlink size={10} />
                                    )}
                                    Hủy liên kết
                                  </button>
                                </div>
                              ) : (
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                                  <UserPlus size={12} />
                                  <span>Chưa có người này trong sổ nợ → Sẽ tạo mới khoản nợ</span>
                                </div>
                              )}

                              {/* Meta: Category, Date, Note */}
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                                <span>📁 {c.categoryName}</span>
                                <span>•</span>
                                <span>📅 {formatDate(c.recordedAt)}</span>
                                {c.note && (
                                  <>
                                    <span>•</span>
                                    <span className="italic truncate max-w-xs">{c.note}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-muted-foreground">
                {actionableList.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span>
                      Đã chọn <strong className="text-foreground">{selectedCount}</strong> / {actionableList.length} giao dịch
                    </span>
                    {/* BUG-3: Nhắc nếu có giao dịch fallback chưa chọn */}
                    {fallbackCount > 0 && (
                      <span className="text-yellow-600 dark:text-yellow-500">
                        ⚠️ {fallbackCount} giao dịch chưa rõ tên người (chưa chọn mặc định)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={submitting || selectedCount === 0 || loading}
                  onClick={handleConfirmSync}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm flex items-center gap-2"
                  style={{
                    backgroundColor: "var(--primary)",
                    opacity: submitting || selectedCount === 0 ? 0.6 : 1,
                    pointerEvents: submitting || selectedCount === 0 ? "none" : "auto",
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Đang đồng bộ...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Xác nhận đồng bộ ({selectedCount})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
