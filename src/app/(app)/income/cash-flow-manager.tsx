"use client";

import { useState, useTransition, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Banknote,
  TrendingUp,
  Plus,
  Calendar,
  Clock,
  Pencil,
  Trash2,
  Building,
  Briefcase,
  Layers,
  Sparkles,
  CircleDollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";
import { formatCurrency, formatDate, toDate } from "@/lib/utils";
import {
  createCashFlowSource,
  updateCashFlowSource,
  toggleCashFlowSource,
  deleteCashFlowSource,
  collectCashFlow,
} from "@/actions/cash-flow";
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

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface CashFlowManagerProps {
  sourcesData: {
    sources: any[];
    upcomingInflows: any[];
    summary: {
      totalMonthlySalary: number;
      totalMonthlyInvestmentYield: number;
      totalMonthlyRental: number;
      totalMonthlyOther: number;
      totalMonthlyExpectedInflows: number;
      totalExpectedThisMonth: number;
      activeCount: number;
      totalCount: number;
    };
    wallets: any[];
    categories: any[];
    investments: any[];
  };
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string; border: string }
> = {
  SALARY: {
    label: "Tiền lương",
    icon: Briefcase,
    color: "#059669",
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.25)",
  },
  INVESTMENT_DIVIDEND: {
    label: "Cổ tức / Đầu tư",
    icon: TrendingUp,
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.1)",
    border: "rgba(124, 58, 237, 0.25)",
  },
  RENTAL: {
    label: "Cho thuê BĐS",
    icon: Building,
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.1)",
    border: "rgba(37, 99, 235, 0.25)",
  },
  INTEREST: {
    label: "Tiền lãi",
    icon: CircleDollarSign,
    color: "#ea580c",
    bg: "rgba(234, 88, 12, 0.1)",
    border: "rgba(234, 88, 12, 0.25)",
  },
  BUSINESS: {
    label: "Kinh doanh",
    icon: Layers,
    color: "#0891b2",
    bg: "rgba(8, 145, 178, 0.1)",
    border: "rgba(8, 145, 178, 0.25)",
  },
  OTHER: {
    label: "Khác",
    icon: Sparkles,
    color: "#64748b",
    bg: "rgba(100, 116, 139, 0.1)",
    border: "rgba(100, 116, 139, 0.25)",
  },
};

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Hàng tháng",
  BIWEEKLY: "2 tuần / lần",
  WEEKLY: "Hàng tuần",
  QUARTERLY: "Hàng quý (3 tháng)",
  YEARLY: "Hàng năm",
  ONE_TIME: "Một lần",
};

export function CashFlowManager({ sourcesData }: CashFlowManagerProps) {
  const { sources, upcomingInflows, summary, wallets, investments } = sourcesData;

  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<any | null>(null);

  const [collectTarget, setCollectTarget] = useState<any | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectWalletId, setCollectWalletId] = useState<string>("");
  const [collectDate, setCollectDate] = useState<string>("");
  const [collectNote, setCollectNote] = useState<string>("");

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const mounted = useMounted();

  // Form state
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formType, setFormType] = useState<string>("SALARY");
  const [formFrequency, setFormFrequency] = useState<string>("MONTHLY");
  const [formDayOfMonth, setFormDayOfMonth] = useState<number>(5);
  const [formNextDate, setFormNextDate] = useState<string>("");
  const [formWalletId, setFormWalletId] = useState<string>("");
  const [formInvestmentId, setFormInvestmentId] = useState<string>("");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formNote, setFormNote] = useState<string>("");

  const openCreateModal = () => {
    setEditingSource(null);
    setFormName("");
    setFormAmount(0);
    setFormType("SALARY");
    setFormFrequency("MONTHLY");
    setFormDayOfMonth(5);

    // Default next date: 5th of current or next month
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth(), 5);
    if (targetDate < now) {
      targetDate.setMonth(targetDate.getMonth() + 1);
    }
    setFormNextDate(targetDate.toISOString().slice(0, 10));

    setFormWalletId(wallets[0]?.id || "");
    setFormInvestmentId("");
    setFormCategoryId("");
    setFormNote("");
    setIsFormOpen(true);
  };

  const openEditModal = (source: any) => {
    setEditingSource(source);
    setFormName(source.name);
    setFormAmount(Number(source.amount));
    setFormType(source.type);
    setFormFrequency(source.frequency);
    setFormDayOfMonth(source.dayOfMonth ?? 5);
    setFormNextDate(toDate(source.nextExpectedDate).toISOString().slice(0, 10));
    setFormWalletId(source.walletId || "");
    setFormInvestmentId(source.investmentId || "");
    setFormCategoryId(source.categoryId || "");
    setFormNote(source.note || "");
    setIsFormOpen(true);
  };

  const openCollectModal = (source: any) => {
    setCollectTarget(source);
    setCollectAmount(Number(source.amount));
    setCollectWalletId(source.walletId || (wallets[0]?.id ?? ""));
    setCollectDate(new Date().toISOString().slice(0, 10));
    setCollectNote(`Ghi nhận từ dòng tiền: ${source.name}`);
  };

  const filteredSources = sources.filter((s) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "ACTIVE") return s.isActive;
    if (activeTab === "PAUSED") return !s.isActive;
    return s.type === activeTab;
  });

  return (
    <div className="space-y-6">
      {/* 4 Thẻ KPI Dòng Tiền Sẽ Có (Expected Cash Inflows) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng dòng tiền dự kiến tháng này */}
        <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent relative overflow-hidden group hover:border-emerald-500/60 transition-all shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Calendar size={14} className="text-emerald-500" />
              Dự kiến về trong tháng này
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Tháng {new Date().getMonth() + 1}
            </span>
          </div>
          <p className="text-2xl font-black text-foreground tracking-tight">
            +{formatCurrency(summary.totalExpectedThisMonth)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Từ {summary.activeCount} nguồn dòng tiền đang bật
          </p>
        </div>

        {/* KPI 2: Dòng tiền từ Lương */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Briefcase size={14} className="text-emerald-600" />
              Lương & Thu nhập chính
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">/ tháng</span>
          </div>
          <p className="text-2xl font-black text-foreground tracking-tight">
            +{formatCurrency(summary.totalMonthlySalary)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Định kỳ hàng tháng ổn định
          </p>
        </div>

        {/* KPI 3: Dòng tiền từ Đầu tư sinh lời (Cổ tức, Lợi nhuận) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp size={14} className="text-purple-600" />
              Dòng tiền từ Đầu tư
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">/ tháng</span>
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
            +{formatCurrency(summary.totalMonthlyInvestmentYield)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Cổ tức, trái phiếu & tài sản sinh lời
          </p>
        </div>

        {/* KPI 4: Cho thuê & Kinh doanh phụ */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building size={14} className="text-blue-600" />
              Cho thuê & Kinh doanh
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">/ tháng</span>
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
            +{formatCurrency(summary.totalMonthlyRental + summary.totalMonthlyOther)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Thu nhập thụ động từ tài sản
          </p>
        </div>
      </div>

      {/* DÒNG TIỀN SẮP VỀ TRONG 30 NGÀY TỚI (UPCOMING INFLOWS TIMELINE) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
              <Clock size={18} className="text-emerald-500" />
              <span>Lịch Dòng Tiền Sắp Về (30 Ngày Tới)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Theo dõi thời điểm dòng tiền chảy vào ví và ghi nhận thu tiền thực tế
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-xs flex items-center gap-1.5 w-fit cursor-pointer"
          >
            <Plus size={14} />
            <span>Thêm nguồn dòng tiền</span>
          </button>
        </div>

        {upcomingInflows.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-border/80 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
            <Calendar size={28} className="mx-auto text-muted-foreground opacity-60" />
            <p className="text-xs font-medium text-muted-foreground">
              Không có khoản dòng tiền nào dự kiến trong 30 ngày tới.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              + Tạo nguồn dòng tiền lương hoặc cổ tức đầu tư
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {upcomingInflows.map((item) => {
              const conf = TYPE_CONFIG[item.type] || TYPE_CONFIG.OTHER;
              const IconComp = conf.icon;
              const nextDate = toDate(item.nextExpectedDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const itemDate = new Date(nextDate);
              itemDate.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil(
                (itemDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );

              let badgeText = `${formatDate(nextDate)}`;
              let badgeColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
              if (diffDays === 0) {
                badgeText = "Hôm nay về 🎉";
                badgeColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold animate-pulse";
              } else if (diffDays === 1) {
                badgeText = "Ngày mai về";
                badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold";
              } else if (diffDays < 0) {
                badgeText = `Đã quá ${Math.abs(diffDays)} ngày`;
                badgeColor = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold";
              } else {
                badgeText = `Còn ${diffDays} ngày (${nextDate.getDate()}/${nextDate.getMonth() + 1})`;
              }

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-border/80 bg-card hover:border-emerald-500/40 hover:shadow-xs transition-all flex flex-col justify-between gap-3 relative group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5"
                        style={{
                          backgroundColor: conf.bg,
                          color: conf.color,
                          border: `1px solid ${conf.border}`,
                        }}
                      >
                        <IconComp size={12} />
                        <span>{conf.label}</span>
                      </span>

                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground line-clamp-1">
                        {item.name}
                      </h4>
                      {item.investment && (
                        <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5 font-medium flex items-center gap-1 truncate">
                          <span>📈 Khoản đầu tư:</span>
                          <strong>{item.investment.name}</strong>
                          {item.investment.ticker && ` (${item.investment.ticker})`}
                        </p>
                      )}
                      {item.note && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {item.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-border/60 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Số tiền dự kiến:</span>
                      <strong className="text-emerald-600 font-extrabold text-sm">
                        +{formatCurrency(Number(item.amount))}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => openCollectModal(item)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-2xs flex items-center gap-1 active:scale-95 cursor-pointer"
                      title="Ghi nhận tiền đã về ví thực tế"
                    >
                      <span>💳</span>
                      <span>Ghi nhận về</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DANH SÁCH QUẢN LÝ CÁC NGUỒN DÒNG TIỀN (SOURCES MANAGER) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
              <Banknote size={18} className="text-primary" />
              <span>Danh Mục Nguồn Dòng Tiền ({sources.length})</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cấu hình các nguồn lương định kỳ, cổ tức đầu tư và tài sản sinh dòng tiền
            </p>
          </div>

          {/* Bộ lọc loại nguồn thu */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({sources.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("SALARY")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "SALARY"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              Lương
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("INVESTMENT_DIVIDEND")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "INVESTMENT_DIVIDEND"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              Đầu tư
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("RENTAL")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "RENTAL"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              Cho thuê
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PAUSED")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "PAUSED"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tạm dừng ({sources.filter((s) => !s.isActive).length})
            </button>
          </div>
        </div>

        {filteredSources.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border/80 text-muted-foreground text-xs space-y-2">
            <p>Chưa có nguồn dòng tiền nào trong mục này.</p>
            <button
              type="button"
              onClick={openCreateModal}
              className="font-bold text-primary hover:underline cursor-pointer"
            >
              + Thêm nguồn dòng tiền mới
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSources.map((source) => {
              const conf = TYPE_CONFIG[source.type] || TYPE_CONFIG.OTHER;
              const IconComp = conf.icon;
              const nextDate = toDate(source.nextExpectedDate);

              return (
                <div
                  key={source.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    source.isActive
                      ? "border-border/80 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                      : "border-border/40 bg-slate-100/40 dark:bg-slate-900/10 opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs mt-0.5"
                      style={{
                        backgroundColor: conf.bg,
                        color: conf.color,
                        border: `1px solid ${conf.border}`,
                      }}
                    >
                      <IconComp size={18} />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {source.name}
                        </h4>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: conf.bg,
                            color: conf.color,
                          }}
                        >
                          {conf.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800">
                          {FREQUENCY_LABELS[source.frequency] || source.frequency}
                        </span>
                        {!source.isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            ⏸ Đang tạm dừng
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>
                          Kỳ tới: <strong>{formatDate(nextDate)}</strong>
                        </span>
                        {source.wallet && (
                          <span>
                            Ví nhận: <strong>{source.wallet.name}</strong>
                          </span>
                        )}
                        {source.investment && (
                          <span className="text-purple-600 dark:text-purple-400 font-medium">
                            Từ đầu tư: <strong>{source.investment.name}</strong>
                          </span>
                        )}
                      </div>

                      {source.note && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {source.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-muted-foreground block">Số tiền dự kiến:</span>
                      <strong className="text-foreground text-sm sm:text-base font-extrabold text-emerald-600">
                        +{formatCurrency(Number(source.amount))}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Nút bật/tắt active */}
                      <button
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            const res = await toggleCashFlowSource(source.id);
                            if (res.success) {
                              toast.success(
                                res.isActive
                                  ? `Đã kích hoạt nguồn "${source.name}"`
                                  : `Đã tạm dừng nguồn "${source.name}"`
                              );
                            }
                          });
                        }}
                        className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          source.isActive
                            ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            : "text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800"
                        }`}
                        title={source.isActive ? "Bấm để tạm dừng" : "Bấm để kích hoạt lại"}
                      >
                        {source.isActive ? "🟢" : "⚪"}
                      </button>

                      {/* Nút sửa */}
                      <button
                        type="button"
                        onClick={() => openEditModal(source)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Chỉnh sửa nguồn dòng tiền"
                      >
                        <Pencil size={14} />
                      </button>

                      {/* Nút xóa */}
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(source.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Xóa nguồn dòng tiền"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL THÊM / SỬA NGUỒN DÒNG TIỀN */}
      {mounted && isFormOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-card border border-border shadow-2xl rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-scale-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                  <Banknote size={18} className="text-primary" />
                  <span>{editingSource ? "Chỉnh sửa nguồn dòng tiền" : "Tạo nguồn dòng tiền mới"}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quản lý tiền lương định kỳ, cổ tức đầu tư và tài sản sinh dòng tiền
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isPending) return;

                if (!formName.trim()) {
                  toast.warning("Vui lòng nhập tên nguồn dòng tiền");
                  return;
                }
                if (!formAmount || formAmount <= 0) {
                  toast.warning("Vui lòng nhập số tiền dự kiến lớn hơn 0");
                  return;
                }
                if (!formNextDate) {
                  toast.warning("Vui lòng chọn ngày dự kiến tiếp theo");
                  return;
                }

                const fd = new FormData();
                fd.set("name", formName.trim());
                fd.set("amount", String(formAmount));
                fd.set("type", formType);
                fd.set("frequency", formFrequency);
                if (formFrequency === "MONTHLY" && formDayOfMonth) {
                  fd.set("dayOfMonth", String(formDayOfMonth));
                }
                fd.set("nextExpectedDate", formNextDate);
                if (formWalletId) fd.set("walletId", formWalletId);
                if (formInvestmentId) fd.set("investmentId", formInvestmentId);
                if (formCategoryId) fd.set("categoryId", formCategoryId);
                if (formNote.trim()) fd.set("note", formNote.trim());

                startTransition(async () => {
                  try {
                    let res: any;
                    if (editingSource) {
                      res = await updateCashFlowSource(editingSource.id, fd);
                    } else {
                      res = await createCashFlowSource(fd);
                    }

                    if (res?.error) {
                      toast.error("Không thể lưu nguồn dòng tiền. Vui lòng kiểm tra lại.");
                    } else {
                      toast.success(
                        editingSource
                          ? `Đã cập nhật nguồn "${formName}" thành công!`
                          : `Đã tạo nguồn dòng tiền "${formName}" thành công!`
                      );
                      setIsFormOpen(false);
                    }
                  } catch (err: any) {
                    console.error(err);
                    toast.error(err?.message || "Lỗi khi lưu nguồn dòng tiền");
                  }
                });
              }}
              className="space-y-4"
            >
              {/* Tên nguồn & Loại */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Tên nguồn dòng tiền
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Lương công ty Tech Corp, Cổ tức FPT quý 3, Cho thuê nhà..."
                    className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Phân loại nguồn thu
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="SALARY">💼 Tiền lương định kỳ</option>
                    <option value="INVESTMENT_DIVIDEND">📈 Cổ tức / Lợi nhuận đầu tư</option>
                    <option value="RENTAL">🏢 Cho thuê BĐS / Tài sản</option>
                    <option value="INTEREST">💰 Tiền lãi gửi / Trái phiếu</option>
                    <option value="BUSINESS">📊 Kinh doanh / Freelance</option>
                    <option value="OTHER">✨ Thu nhập định kỳ khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Chu kỳ dòng tiền
                  </label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                    className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="MONTHLY">Hàng tháng</option>
                    <option value="BIWEEKLY">2 tuần / lần</option>
                    <option value="WEEKLY">Hàng tuần</option>
                    <option value="QUARTERLY">Hàng quý (3 tháng/lần)</option>
                    <option value="YEARLY">Hàng năm</option>
                    <option value="ONE_TIME">Một lần trong tương lai</option>
                  </select>
                </div>
              </div>

              {/* Số tiền dự kiến */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Số tiền dự kiến mỗi kỳ (₫)
                </label>
                <SmartCurrencyInput
                  name="amount"
                  value={formAmount > 0 ? formAmount : undefined}
                  required
                  min={1000}
                  placeholder="VD: 25,000,000"
                  showQuickButtons={true}
                  showWordsPreview={true}
                  onChangeValue={(val) => setFormAmount(val)}
                />
              </div>

              {/* Ngày nhận tiền */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-border">
                {formFrequency === "MONTHLY" && (
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Ngày nhận trong tháng (1 - 31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={formDayOfMonth}
                      onChange={(e) => setFormDayOfMonth(Number(e.target.value) || 5)}
                      className="w-full bg-background rounded-xl px-3.5 py-2 text-foreground font-medium text-sm border border-slate-200 focus:border-emerald-500"
                    />
                  </div>
                )}

                <div className={formFrequency === "MONTHLY" ? "" : "sm:col-span-2"}>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Ngày dự kiến nhận tiếp theo
                  </label>
                  <input
                    type="date"
                    required
                    value={formNextDate}
                    onChange={(e) => setFormNextDate(e.target.value)}
                    className="w-full bg-background rounded-xl px-3.5 py-2 text-foreground font-medium text-sm border border-slate-200 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Liên kết ví nhận & khoản đầu tư (nếu có) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Ví / Tài khoản nhận tiền
                  </label>
                  <select
                    value={formWalletId}
                    onChange={(e) => setFormWalletId(e.target.value)}
                    className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm border border-slate-200 focus:border-emerald-500"
                  >
                    <option value="">-- Chưa chỉ định ví --</option>
                    {wallets.map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatCurrency(Number(w.balance))})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Liên kết khoản đầu tư (nếu là cổ tức/lợi nhuận) */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Liên kết khoản đầu tư (Tùy chọn)
                  </label>
                  <select
                    value={formInvestmentId}
                    onChange={(e) => setFormInvestmentId(e.target.value)}
                    className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm border border-slate-200 focus:border-emerald-500"
                  >
                    <option value="">-- Không liên kết --</option>
                    {investments.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} {inv.ticker ? `(${inv.ticker})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Ghi chú (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="VD: Sau khi trừ thuế & bảo hiểm, cổ tức tạm ứng đợt 1..."
                  className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm border border-slate-200 focus:border-emerald-500"
                />
              </div>

              {/* Nút hành động */}
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm transition-all"
                  style={{ opacity: isPending ? 0.7 : 1 }}
                >
                  {isPending ? "Đang lưu..." : editingSource ? "Lưu thay đổi" : "Tạo nguồn dòng tiền"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 1-CLICK: GHI NHẬN TIỀN VỀ (COLLECT CASH IN) */}
      {mounted && collectTarget && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-card border border-border shadow-2xl rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-scale-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                  <span>🎉</span>
                  <span>Ghi nhận tiền đã về ví</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Xác nhận nguồn thu &ldquo;{collectTarget.name}&rdquo; đã chuyển khoản thành công
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollectTarget(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isPending) return;

                if (!collectAmount || collectAmount <= 0) {
                  toast.warning("Vui lòng nhập số tiền thực nhận lớn hơn 0");
                  return;
                }
                if (!collectWalletId) {
                  toast.warning("Vui lòng chọn ví nhận tiền");
                  return;
                }

                const fd = new FormData();
                fd.set("sourceId", collectTarget.id);
                fd.set("actualAmount", String(collectAmount));
                fd.set("walletId", collectWalletId);
                fd.set("receivedDate", collectDate || new Date().toISOString());
                if (collectNote.trim()) fd.set("note", collectNote.trim());

                startTransition(async () => {
                  try {
                    const res = await collectCashFlow(fd);
                    if (res?.error || !res?.actualAmount) {
                      toast.error("Không thể ghi nhận tiền về. Vui lòng thử lại.");
                    } else {
                      toast.success(
                        `🎉 Đã cộng ${formatCurrency(res.actualAmount)} vào ví ${res.walletName}! Lịch nhận tiếp theo: ${formatDate(res.nextExpectedDate)}.`,
                        { duration: 5000 }
                      );
                      setCollectTarget(null);
                    }
                  } catch (err: any) {
                    console.error(err);
                    toast.error(err?.message || "Lỗi khi ghi nhận tiền về");
                  }
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Số tiền thực nhận (₫)
                </label>
                <SmartCurrencyInput
                  name="actualAmount"
                  value={collectAmount > 0 ? collectAmount : undefined}
                  required
                  min={1000}
                  placeholder="VD: 25,000,000"
                  showQuickButtons={true}
                  showWordsPreview={true}
                  onChangeValue={(val) => setCollectAmount(val)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Tài khoản / Ví nhận tiền
                </label>
                <select
                  required
                  value={collectWalletId}
                  onChange={(e) => setCollectWalletId(e.target.value)}
                  className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm border border-slate-200 focus:border-emerald-500"
                >
                  <option value="">-- Chọn ví nhận tiền --</option>
                  {wallets.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatCurrency(Number(w.balance))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Ngày nhận tiền
                </label>
                <input
                  type="date"
                  required
                  value={collectDate}
                  onChange={(e) => setCollectDate(e.target.value)}
                  className="w-full bg-background rounded-xl px-3.5 py-2 text-foreground font-medium text-sm border border-slate-200 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Mô tả / Ghi chú giao dịch
                </label>
                <input
                  type="text"
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  className="w-full bg-background rounded-xl px-3.5 py-2 text-foreground font-medium text-sm border border-slate-200 focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span>💡 Tự động hóa:</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  Hệ thống sẽ tự động cộng tiền vào ví đã chọn, tạo 1 giao dịch thu nhập (Income Transaction) và tự động dời lịch dự kiến sang kỳ tiếp theo!
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setCollectTarget(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm transition-all"
                  style={{ opacity: isPending ? 0.7 : 1 }}
                >
                  {isPending ? "Đang xử lý..." : "Xác nhận đã nhận tiền"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM DELETE DIALOG */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nguồn dòng tiền</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa nguồn dòng tiền này? Lịch nhận tiền tương lai của nguồn này sẽ bị hủy bỏ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTargetId(null)}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTargetId) return;
                startTransition(async () => {
                  const res = await deleteCashFlowSource(deleteTargetId);
                  if (res.success) {
                    toast.success("Đã xóa nguồn dòng tiền thành công");
                  } else {
                    toast.error("Không thể xóa nguồn dòng tiền");
                  }
                  setDeleteTargetId(null);
                });
              }}
            >
              Xác nhận xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
