import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, serializeData } from "@/lib/utils";
import { createInvestment } from "@/actions/investments";
import { redirect } from "next/navigation";
import { InvestmentListClient } from "./investment-list-client";
import { Plus, TrendingUp, Briefcase, BarChart3, Layers } from "lucide-react";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";


export default async function InvestmentsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const investments = await db.orm.public.Investment
      .where((inv) => inv.userId.eq(session.user.id))
      .include("logs", (log) => log.orderBy((l) => l.recordedAt.desc()).limit(10))
      .orderBy((inv) => inv.createdAt.desc())
      .all();

    let totalInvested = 0;
    let totalCurrentValue = 0;

    investments.forEach((inv: any) => {
      totalInvested += Number(inv.buyPrice) * Number(inv.quantity);
      totalCurrentValue += (Number(inv.currentPrice) || Number(inv.buyPrice)) * Number(inv.quantity);
    });

    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    const isProfit = totalPnL >= 0;

    const plainInvestments = serializeData(investments);

    return (
      <div className="space-y-6 animate-fade-in w-full">
        {/* Page Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <TrendingUp size={20} />
            </div>
            <div>
              <h1 className="page-header-title">Danh mục Đầu tư</h1>
              <p className="page-header-subtitle">Theo dõi cổ phiếu, crypto, vàng và các tài sản sinh lời</p>
            </div>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <div className="kpi-card" style={{ "--kpi-accent": "#2563eb" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className="kpi-card-icon bg-blue-100 text-blue-600">
                <Briefcase size={18} />
              </div>
              <span className="kpi-card-label text-blue-700">Tổng vốn đầu tư</span>
            </div>
            <p className="kpi-card-value text-foreground">{formatCurrency(totalInvested)}</p>
            <p className="kpi-card-sub">Tổng vốn bỏ ra</p>
          </div>

          <div className="kpi-card" style={{ "--kpi-accent": "#7c3aed" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className="kpi-card-icon bg-violet-100 text-violet-600">
                <BarChart3 size={18} />
              </div>
              <span className="kpi-card-label text-violet-700">Giá trị hiện tại</span>
            </div>
            <p className="kpi-card-value text-foreground">{formatCurrency(totalCurrentValue)}</p>
            <p className="kpi-card-sub">Giá trị thị trường</p>
          </div>

          <div className="kpi-card" style={{ "--kpi-accent": isProfit ? "#059669" : "#e11d48" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className={`kpi-card-icon ${isProfit ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                <TrendingUp size={18} />
              </div>
              <span className={`kpi-card-label ${isProfit ? "text-emerald-700" : "text-rose-700"}`}>Tổng P&L</span>
            </div>
            <p className={`kpi-card-value ${isProfit ? "text-emerald-600" : "text-rose-600"}`}>
              {totalPnL > 0 ? "+" : ""}
              {formatCurrency(totalPnL)}
            </p>
            <p className="kpi-card-sub">{totalPnLPercent.toFixed(2)}% {isProfit ? "lợi nhuận" : "lỗ"}</p>
          </div>

          <div className="kpi-card" style={{ "--kpi-accent": "#ea580c" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className="kpi-card-icon bg-orange-100 text-orange-600">
                <Layers size={18} />
              </div>
              <span className="kpi-card-label text-orange-700">Số loại tài sản</span>
            </div>
            <p className="kpi-card-value text-foreground">{investments.length}</p>
            <p className="kpi-card-sub">Loại tài sản</p>
          </div>
        </div>

        {/* Investment Cards Grid with Bulk Delete */}
        <InvestmentListClient investments={plainInvestments} />

        {/* Add Form */}
        <div className="card bg-gradient-to-br from-blue-50/50 to-white border-blue-200/60">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Plus size={16} className="text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Thêm tài sản đầu tư mới</h2>
          </div>
          <form
            action={async (fd) => {
              "use server";
              await createInvestment(fd);
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
          >
            <div>
              <label className="form-label form-label-required">Tên tài sản</label>
              <input
                type="text"
                name="name"
                required
                className="form-input"
                placeholder="VD: Cổ phiếu FPT, Bitcoin..."
              />
            </div>
            <div>
              <label className="form-label">Mã (Ticker)</label>
              <input
                type="text"
                name="ticker"
                className="form-input"
                placeholder="FPT / BTC"
              />
            </div>
            <div>
              <label className="form-label form-label-required">Số lượng</label>
              <input
                type="number"
                step="any"
                min="0.00000001"
                name="quantity"
                required
                className="form-input"
                placeholder="100"
              />
            </div>
            <div>
              <label className="form-label form-label-required">Giá mua (₫)</label>
              <SmartCurrencyInput
                name="buyPrice"
                required
                allowDecimals
                className="form-input"
                placeholder="VD: 100.000"
                showQuickButtons
                showWordsPreview
              />
            </div>
            <div>
              <label className="form-label form-label-required">Ngày mua</label>
              <input
                type="date"
                name="boughtAt"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="form-input"
              />
            </div>
            <div className="lg:col-span-5 flex justify-end mt-2">
              <button
                type="submit"
                className="w-full sm:w-auto btn-primary py-2.5 px-6 text-sm flex justify-center cursor-pointer"
              >
                <Plus size={16} className="mr-1.5" />
                Thêm tài sản đầu tư
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  } catch (error) {
    console.error(error);
    return (
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <p className="empty-state-title text-rose-600">Đã xảy ra lỗi khi tải dữ liệu đầu tư.</p>
      </div>
    );
  }
}
