import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { createInvestment } from "@/actions/investments";
import { redirect } from "next/navigation";
import { InvestmentCard } from "./investment-card";
import { Plus } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đầu tư | wnWallet",
};

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

    return (
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Danh mục Đầu tư</h1>
            <p className="text-muted text-sm mt-1">Theo dõi cổ phiếu, crypto, vàng và các tài sản sinh lời</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <p className="text-muted text-xs font-medium uppercase tracking-wider">Tổng vốn đầu tư</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{formatCurrency(totalInvested)}</p>
          </div>
          <div className="card p-5">
            <p className="text-muted text-xs font-medium uppercase tracking-wider">Giá trị hiện tại</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{formatCurrency(totalCurrentValue)}</p>
          </div>
          <div className="card p-5">
            <p className="text-muted text-xs font-medium uppercase tracking-wider">Tổng Lợi nhuận (P&L)</p>
            <p className={`text-2xl font-bold mt-1 ${isProfit ? "text-income" : "text-expense"}`}>
              {totalPnL > 0 ? "+" : ""}
              {formatCurrency(totalPnL)} ({totalPnLPercent.toFixed(2)}%)
            </p>
          </div>
          <div className="card p-5">
            <p className="text-muted text-xs font-medium uppercase tracking-wider">Số loại tài sản</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{investments.length}</p>
          </div>
        </div>

        {/* List */}
        {investments.length === 0 ? (
          <div className="card text-center py-12 border-dashed">
            <p className="text-4xl mb-3">📈</p>
            <h2 className="text-lg font-semibold mb-1">Chưa có khoản đầu tư nào</h2>
            <p className="text-muted text-sm mb-4">Hãy thêm khoản đầu tư đầu tiên của bạn để theo dõi sinh lời.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {investments.map((inv: any) => (
              <InvestmentCard key={inv.id} inv={inv} />
            ))}
          </div>
        )}

        {/* Add Form */}
        <div className="card mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={18} className="text-primary" />
            <h2 className="text-lg font-bold">Thêm tài sản đầu tư mới</h2>
          </div>
          <form
            action={async (fd) => {
              "use server";
              await createInvestment(fd);
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">
                Tên tài sản <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                className="w-full bg-elevated border border-border-strong rounded px-3 py-2 outline-none focus:border-primary text-sm text-foreground"
                placeholder="VD: Cổ phiếu FPT, Bitcoin..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Mã (Ticker)</label>
              <input
                type="text"
                name="ticker"
                className="w-full bg-elevated border border-border-strong rounded px-3 py-2 outline-none focus:border-primary text-sm text-foreground"
                placeholder="FPT / BTC"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">
                Số lượng <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.00000001"
                name="quantity"
                required
                className="w-full bg-elevated border border-border-strong rounded px-3 py-2 outline-none focus:border-primary text-sm text-foreground"
                placeholder="100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">
                Giá mua (₫) <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                name="buyPrice"
                required
                className="w-full bg-elevated border border-border-strong rounded px-3 py-2 outline-none focus:border-primary text-sm text-foreground"
                placeholder="100000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">
                Ngày mua <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                name="boughtAt"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full bg-elevated border border-border-strong rounded px-3 py-2 outline-none focus:border-primary text-sm text-foreground"
              />
            </div>
            <div className="lg:col-span-5 flex justify-end mt-2">
              <button
                type="submit"
                className="w-full sm:w-auto btn-primary py-2 px-6 text-sm flex justify-center cursor-pointer"
              >
                + Thêm tài sản đầu tư
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  } catch (error) {
    console.error(error);
    return (
      <div className="card text-center text-danger py-12">
        <p>Đã xảy ra lỗi khi tải dữ liệu đầu tư.</p>
      </div>
    );
  }
}
