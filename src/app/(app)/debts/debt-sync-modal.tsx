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
  Trash2,
  EyeOff,
  Check,
} from "lucide-react";
import {
  getDebtSyncCandidates,
  dismissDebtSyncCandidate,
  dismissDebtSyncCandidates,
  syncTransactionsToDebtsAdvanced,
  unlinkTxFromDebts,
} from "@/actions/debts";
import { deleteTransaction } from "@/actions/transactions";
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
  isRepayment: boolean;
  actionType: "MERGE" | "CREATE" | "PAYMENT" | "DUPLICATE";
  targetDebtId?: string;
  targetDebtPerson?: string;
  targetDebtCurrentAmount?: number;
  targetDebtNewAmount?: number;
  targetDebtPaidAmount?: number;
  targetDebtNewPaidAmount?: number;
  personIsFallback: boolean;
}

interface ActiveDebt {
  id: string;
  person: string;
  amount: number;
  paidAmount: number;
  direction: "OWE" | "OWED";
  status: string;
  note?: string | null;
}

interface Summary {
  totalFound: number;
  toCreateCount: number;
  toMergeCount: number;
  toPaymentCount?: number;
  duplicateCount: number;
  toCreateAmount: number;
  toMergeAmount: number;
  toPaymentAmount?: number;
  totalActionableAmount: number;
  isLimited?: boolean;
}

interface CandidateConfig {
  actionType: "CREATE" | "MERGE" | "PAYMENT";
  person: string;
  direction: "OWE" | "OWED";
  targetDebtId: string;
}

export function DebtSyncModal({ triggerButton }: { triggerButton?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDismissing, setBulkDismissing] = useState(false);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeDebts, setActiveDebts] = useState<ActiveDebt[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [configs, setConfigs] = useState<Record<string, CandidateConfig>>({});
  const [activeTab, setActiveTab] = useState<"actionable" | "create" | "merge" | "payment" | "duplicate" | "all">("actionable");
  const mounted = useMounted();

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const res = await getDebtSyncCandidates();
      setCandidates(res.candidates);
      setSummary(res.summary);
      setActiveDebts((res.activeDebts as ActiveDebt[]) || []);

      // Khởi tạo configs cho mỗi candidate
      const initialConfigs: Record<string, CandidateConfig> = {};
      for (const c of res.candidates) {
        initialConfigs[c.txId] = {
          actionType: c.actionType === "DUPLICATE" ? "CREATE" : c.actionType,
          person: c.person,
          direction: c.direction,
          targetDebtId: c.targetDebtId || "",
        };
      }
      setConfigs(initialConfigs);

      // Mặc định chọn các giao dịch hợp lệ
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

  const updateConfig = (txId: string, partial: Partial<CandidateConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [txId]: {
        ...(prev[txId] || {
          actionType: "CREATE",
          person: "",
          direction: "OWE",
          targetDebtId: "",
        }),
        ...partial,
      },
    }));
  };

  const handleDismiss = async (txId: string) => {
    setDismissingId(txId);
    try {
      const res = await dismissDebtSyncCandidate(txId);
      if (res?.success) {
        toast.success("Đã bỏ qua giao dịch. Giao dịch này sẽ không xuất hiện trong lần đồng bộ sau.", {
          duration: 3500,
        });
        setCandidates((prev) => prev.filter((c) => c.txId !== txId));
        setSelectedTxIds((prev) => {
          const next = new Set(prev);
          next.delete(txId);
          return next;
        });
      } else {
        toast.error("Không thể bỏ qua giao dịch");
      }
    } catch (err) {
      console.error(err);
      toast.error("Đã xảy ra lỗi khi bỏ qua giao dịch");
    } finally {
      setDismissingId(null);
    }
  };

  const handleBulkDismiss = async () => {
    const ids = Array.from(selectedTxIds);
    if (ids.length === 0) return;
    setBulkDismissing(true);
    try {
      const res = await dismissDebtSyncCandidates(ids);
      if (res?.success) {
        toast.success(`Đã bỏ qua ${res.count} giao dịch khỏi danh sách đồng bộ.`);
        setCandidates((prev) => prev.filter((c) => !selectedTxIds.has(c.txId)));
        setSelectedTxIds(new Set());
      } else {
        toast.error("Không thể bỏ qua các giao dịch");
      }
    } catch (err) {
      console.error(err);
      toast.error("Đã xảy ra lỗi khi bỏ qua hàng loạt");
    } finally {
      setBulkDismissing(false);
    }
  };

  const handleDeleteTx = async (txId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn XÓA vĩnh viễn giao dịch này? Dữ liệu ví và thống kê sẽ được cập nhật lại.")) {
      return;
    }
    setDeletingId(txId);
    try {
      const res = await deleteTransaction(txId);
      if (res?.success) {
        toast.success("Đã xóa giao dịch thành công.");
        setCandidates((prev) => prev.filter((c) => c.txId !== txId));
        setSelectedTxIds((prev) => {
          const next = new Set(prev);
          next.delete(txId);
          return next;
        });
      } else {
        toast.error(typeof res?.error === "string" ? res.error : "Không thể xóa giao dịch");
      }
    } catch (err) {
      console.error(err);
      toast.error("Đã xảy ra lỗi khi xóa giao dịch");
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmSync = async () => {
    const idsToSync = Array.from(selectedTxIds);
    if (idsToSync.length === 0) {
      toast.warning("Vui lòng chọn ít nhất một giao dịch để đồng bộ");
      return;
    }

    // Build payload
    const items = idsToSync.map((id) => {
      const cand = candidates.find((c) => c.txId === id);
      const cfg = configs[id];
      const actionType = cfg?.actionType || (cand?.actionType === "DUPLICATE" ? "CREATE" : cand?.actionType) || "CREATE";
      const person = cfg?.person || cand?.person || "";
      const direction = cfg?.direction || cand?.direction || "OWE";
      const targetDebtId = cfg?.targetDebtId || cand?.targetDebtId || undefined;

      return {
        txId: id,
        actionType,
        person,
        direction,
        targetDebtId,
      };
    });

    // Validate if MERGE or PAYMENT has targetDebtId
    for (const item of items) {
      if ((item.actionType === "MERGE" || item.actionType === "PAYMENT") && !item.targetDebtId) {
        toast.error(`Vui lòng chọn khoản nợ đích cho giao dịch của "${item.person}" hoặc chuyển sang "Tạo khoản nợ mới".`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await syncTransactionsToDebtsAdvanced(items);
      if (res?.error) {
        toast.error(res.error);
      } else {
        const parts = [];
        if (res.createdCount) parts.push(`tạo mới ${res.createdCount}`);
        if (res.mergedCount) parts.push(`gộp ${res.mergedCount}`);
        if (res.paymentCount) parts.push(`ghi nhận trả nợ ${res.paymentCount}`);
        const detailStr = parts.length > 0 ? parts.join(", ") : "thành công";
        toast.success(`Đã đồng bộ ${detailStr} khoản nợ vào sổ nợ!`, { duration: 4500 });
        setIsOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Đã xảy ra lỗi khi thực hiện đồng bộ vào sổ nợ");
    } finally {
      setSubmitting(false);
    }
  };

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
    const currentAction = configs[c.txId]?.actionType || c.actionType;
    if (activeTab === "actionable") return c.actionType !== "DUPLICATE";
    if (activeTab === "create") return currentAction === "CREATE" && c.actionType !== "DUPLICATE";
    if (activeTab === "merge") return currentAction === "MERGE" && c.actionType !== "DUPLICATE";
    if (activeTab === "payment") return currentAction === "PAYMENT" && c.actionType !== "DUPLICATE";
    if (activeTab === "duplicate") return c.actionType === "DUPLICATE";
    return true;
  });

  const actionableList = candidates.filter((c) => c.actionType !== "DUPLICATE");
  const selectedCount = Array.from(selectedTxIds).filter((id) =>
    actionableList.some((c) => c.txId === id)
  ).length;

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
            className="bg-card border border-border shadow-2xl rounded-2xl max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-scale-in text-foreground"
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
                    Tùy chỉnh hành động cho từng giao dịch: tạo mới, gộp nợ cũ hoặc ghi nhận trả nợ
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
                  {summary?.isLimited && (
                    <div className="p-3 rounded-xl border border-orange-400/30 bg-orange-500/8 flex items-start gap-2 text-xs text-orange-700 dark:text-orange-400">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        <strong>Lưu ý:</strong> Hệ thống chỉ quét 2,000 giao dịch gần nhất. Các giao dịch cũ hơn có thể chưa được hiển thị.
                      </span>
                    </div>
                  )}

                  {fallbackCount > 0 && (
                    <div className="p-3 rounded-xl border border-yellow-400/30 bg-yellow-500/8 flex items-start gap-2 text-xs text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Lưu ý:</span>{" "}
                        <span>
                          Có {fallbackCount} giao dịch chưa có tên người rõ ràng trong ghi chú. Bạn có thể <strong>nhập trực tiếp tên đối tác</strong> ở từng dòng bên dưới trước khi đồng bộ.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Thêm mới */}
                    <div className="p-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-0.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-600">
                        <span className="flex items-center gap-1">
                          <UserPlus size={13} /> Tạo mới
                        </span>
                        <span className="text-sm font-bold">{summary?.toCreateCount ?? 0}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {formatCurrency(summary?.toCreateAmount ?? 0)}
                      </p>
                    </div>

                    {/* Gộp nợ cũ */}
                    <div className="p-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-0.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-amber-600">
                        <span className="flex items-center gap-1">
                          <Layers size={13} /> Gộp nợ cũ
                        </span>
                        <span className="text-sm font-bold">{summary?.toMergeCount ?? 0}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {formatCurrency(summary?.toMergeAmount ?? 0)}
                      </p>
                    </div>

                    {/* Trả nợ */}
                    <div className="p-2.5 rounded-xl border border-blue-500/25 bg-blue-500/5 space-y-0.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-blue-600">
                        <span className="flex items-center gap-1">
                          <Check size={13} /> Trả nợ
                        </span>
                        <span className="text-sm font-bold">{summary?.toPaymentCount ?? 0}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {formatCurrency(summary?.toPaymentAmount ?? 0)}
                      </p>
                    </div>

                    {/* Trùng lặp */}
                    <div className="p-2.5 rounded-xl border border-border bg-slate-50 dark:bg-slate-800/40 space-y-0.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ShieldCheck size={13} /> Đã vào sổ
                        </span>
                        <span className="text-sm font-bold">{summary?.duplicateCount ?? 0}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        Tự động bỏ qua
                      </p>
                    </div>
                  </div>

                  {/* Filter tabs & Bulk Actions */}
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
                        Cần xử lý ({actionableList.length})
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
                        onClick={() => setActiveTab("payment")}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          activeTab === "payment"
                            ? "bg-blue-600 text-white font-bold"
                            : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Trả nợ ({summary?.toPaymentCount ?? 0})
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
                        Đã vào sổ ({summary?.duplicateCount})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
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

                      {selectedCount > 0 && (
                        <button
                          type="button"
                          disabled={bulkDismissing}
                          onClick={handleBulkDismiss}
                          className="text-[11px] text-muted-foreground hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-lg border border-border"
                          title="Bỏ qua các giao dịch đã chọn để không hiển thị trong lần đồng bộ sau"
                        >
                          <EyeOff size={11} />
                          <span>Bỏ qua ({selectedCount})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Candidate List */}
                  <div className="space-y-3">
                    {filteredCandidates.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Không có giao dịch nào trong mục này.
                      </div>
                    ) : (
                      filteredCandidates.map((c) => {
                        const isSelected = selectedTxIds.has(c.txId);
                        const isDup = c.actionType === "DUPLICATE";
                        const isUnlinking = unlinkingId === c.txId;
                        const isDismissing = dismissingId === c.txId;
                        const isDeleting = deletingId === c.txId;

                        const cfg = configs[c.txId] || {
                          actionType: c.actionType === "DUPLICATE" ? "CREATE" : c.actionType,
                          person: c.person,
                          direction: c.direction,
                          targetDebtId: c.targetDebtId || "",
                        };

                        // Danh sách nợ khả dụng để gộp hoặc trả nợ (cùng chiều nợ)
                        const matchingDebts = activeDebts.filter(
                          (d) => d.direction === cfg.direction
                        );

                        return (
                          <div
                            key={c.txId}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 text-xs ${
                              isDup
                                ? "opacity-75 bg-slate-50 dark:bg-slate-900/40 border-border"
                                : isSelected
                                ? "border-primary/50 bg-primary/5 shadow-2xs"
                                : "border-border bg-card"
                            }`}
                          >
                            {/* Top row: Checkbox, Person, Direction, Amount */}
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                                {!isDup ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectOne(c.txId)}
                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                                  />
                                ) : (
                                  <div className="w-4 h-4 shrink-0" />
                                )}

                                {/* Editable Person Name Input */}
                                <div className="flex-1 max-w-xs">
                                  <input
                                    type="text"
                                    disabled={isDup}
                                    value={cfg.person}
                                    onChange={(e) => updateConfig(c.txId, { person: e.target.value })}
                                    placeholder="Tên đối tác / người vay"
                                    className="w-full font-bold text-sm bg-transparent border-b border-border/80 focus:border-primary focus:outline-hidden px-1 py-0.5 text-foreground placeholder:text-muted-foreground/60 transition-colors"
                                  />
                                </div>

                                {/* Direction toggle */}
                                {!isDup ? (
                                  <div className="flex items-center rounded-lg border border-border p-0.5 bg-background shrink-0 text-[10px] font-bold">
                                    <button
                                      type="button"
                                      onClick={() => updateConfig(c.txId, { direction: "OWE" })}
                                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                        cfg.direction === "OWE"
                                          ? "bg-rose-500 text-white shadow-2xs"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      Tôi nợ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateConfig(c.txId, { direction: "OWED" })}
                                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                        cfg.direction === "OWED"
                                          ? "bg-emerald-500 text-white shadow-2xs"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      Cho vay
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      c.direction === "OWE"
                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                    }`}
                                  >
                                    {c.direction === "OWE" ? "Tôi đi vay" : "Cho vay"}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-extrabold text-sm text-foreground">
                                  {formatCurrency(c.amount)}
                                </span>
                              </div>
                            </div>

                            {/* Middle section: Action Configuration (if not dup) */}
                            {!isDup && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/60">
                                {/* Action selection */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-muted-foreground">
                                    Hành động đồng bộ:
                                  </label>
                                  <select
                                    value={cfg.actionType}
                                    onChange={(e) =>
                                      updateConfig(c.txId, {
                                        actionType: e.target.value as "CREATE" | "MERGE" | "PAYMENT",
                                      })
                                    }
                                    className="w-full text-xs font-semibold rounded-lg border border-border bg-background px-2.5 py-1.5 focus:border-primary focus:outline-hidden cursor-pointer"
                                  >
                                    <option value="CREATE">🆕 Tạo khoản nợ mới</option>
                                    <option value="MERGE">➕ Gộp vào nợ cũ</option>
                                    <option value="PAYMENT">✅ Ghi nhận trả nợ</option>
                                  </select>
                                </div>

                                {/* Target debt selector if MERGE or PAYMENT */}
                                {(cfg.actionType === "MERGE" || cfg.actionType === "PAYMENT") && (
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground">
                                      Khoản nợ đích:
                                    </label>
                                    <select
                                      value={cfg.targetDebtId}
                                      onChange={(e) => updateConfig(c.txId, { targetDebtId: e.target.value })}
                                      className="w-full text-xs rounded-lg border border-border bg-background px-2 py-1.5 focus:border-primary focus:outline-hidden cursor-pointer"
                                    >
                                      <option value="">-- Chọn khoản nợ cần liên kết --</option>
                                      {matchingDebts.map((d) => (
                                        <option key={d.id} value={d.id}>
                                          {d.person} - Nợ: {formatCurrency(d.amount)} (Còn lại: {formatCurrency(d.amount - d.paidAmount)})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Status and Action description banner */}
                            {isDup ? (
                              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                                  <span>Đã được đồng bộ trước đó. Tự động loại trừ để chống trùng lặp.</span>
                                </div>
                                <button
                                  type="button"
                                  disabled={isUnlinking}
                                  onClick={() => handleUnlink(c.txId)}
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
                            ) : cfg.actionType === "MERGE" ? (
                              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 flex items-center justify-between flex-wrap gap-1">
                                <span className="flex items-center gap-1 font-semibold">
                                  <Layers size={13} /> Sẽ cộng thêm +{formatCurrency(c.amount)} vào khoản nợ cũ
                                </span>
                                {c.targetDebtCurrentAmount !== undefined && c.targetDebtNewAmount !== undefined && (
                                  <span className="font-medium text-[10px]">
                                    {formatCurrency(c.targetDebtCurrentAmount)} <ArrowRight size={10} className="inline mx-0.5" /> <strong>{formatCurrency(c.targetDebtNewAmount)}</strong>
                                  </span>
                                )}
                              </div>
                            ) : cfg.actionType === "PAYMENT" ? (
                              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-400 flex items-center justify-between flex-wrap gap-1">
                                <span className="flex items-center gap-1 font-semibold">
                                  <Check size={13} /> Sẽ ghi nhận thanh toán {formatCurrency(c.amount)} vào khoản nợ
                                </span>
                              </div>
                            ) : (
                              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                                <UserPlus size={12} />
                                <span>Sẽ tạo một khoản nợ mới với số tiền {formatCurrency(c.amount)}</span>
                              </div>
                            )}

                            {/* Bottom row: Category, Date, Note + Action buttons (Dismiss, Delete) */}
                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>📁 {c.categoryName}</span>
                                <span>•</span>
                                <span>📅 {formatDate(c.recordedAt)}</span>
                                {c.note && (
                                  <>
                                    <span>•</span>
                                    <span className="italic truncate max-w-[200px]" title={c.note}>
                                      {c.note}
                                    </span>
                                  </>
                                )}
                              </div>

                              {!isDup && (
                                <div className="flex items-center gap-1.5">
                                  {/* Nút Bỏ qua */}
                                  <button
                                    type="button"
                                    disabled={isDismissing || submitting}
                                    onClick={() => handleDismiss(c.txId)}
                                    className="px-2 py-1 rounded-md text-[10px] font-semibold text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors flex items-center gap-1 cursor-pointer border border-border/70"
                                    title="Bỏ qua giao dịch này, không đồng bộ và không nhắc lại"
                                  >
                                    {isDismissing ? <RefreshCw size={10} className="animate-spin" /> : <EyeOff size={10} />}
                                    <span>Bỏ qua</span>
                                  </button>

                                  {/* Nút Xóa giao dịch */}
                                  <button
                                    type="button"
                                    disabled={isDeleting || submitting}
                                    onClick={() => handleDeleteTx(c.txId)}
                                    className="px-2 py-1 rounded-md text-[10px] font-semibold text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer border border-border/70"
                                    title="Xóa giao dịch này khỏi hệ thống"
                                  >
                                    {isDeleting ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                    <span>Xóa GD</span>
                                  </button>
                                </div>
                              )}
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
                    {fallbackCount > 0 && (
                      <span className="text-yellow-600 dark:text-yellow-500 text-[11px]">
                        ⚠️ {fallbackCount} giao dịch chưa rõ tên đối tác (vui lòng kiểm tra lại)
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
