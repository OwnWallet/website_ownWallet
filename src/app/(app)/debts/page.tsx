import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, serializeData } from "@/lib/utils";
import { DebtActions } from "./debt-actions";
import { DebtListClient } from "./debt-list-client";
import { HandCoins, TrendingDown, TrendingUp } from "lucide-react";



export default async function DebtsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  let debts: any[] = [];
  try {
    debts = await db.orm.public.Debt
      .where((d) => d.userId.eq(userId))
      .orderBy((d) => d.createdAt.desc())
      .all();
  } catch (error) {
    console.error("Failed to fetch debts:", error);
    return (
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <p className="empty-state-title text-rose-600">Đã có lỗi xảy ra khi tải dữ liệu nợ.</p>
      </div>
    );
  }

  const plainDebts = serializeData(debts);
  const owes = plainDebts.filter((d: any) => d.direction === "OWE");
  const oweds = plainDebts.filter((d: any) => d.direction === "OWED");

  const totalOwe = owes.reduce((sum: number, d: any) => sum + Number(d.amount) - Number(d.paidAmount), 0);
  const totalOwed = oweds.reduce((sum: number, d: any) => sum + Number(d.amount) - Number(d.paidAmount), 0);

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
            <HandCoins size={20} />
          </div>
          <div>
            <h1 className="page-header-title">Quản lý Nợ</h1>
            <p className="page-header-subtitle">Theo dõi các khoản vay và cho vay</p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
        <div className="kpi-card" style={{ "--kpi-accent": "#e11d48" } as React.CSSProperties}>
          <div className="kpi-card-header">
            <div className="kpi-card-icon bg-rose-100 text-rose-600">
              <TrendingDown size={18} />
            </div>
            <span className="kpi-card-label text-rose-700">Tổng nợ phải trả</span>
          </div>
          <p className="kpi-card-value text-rose-600">{formatCurrency(totalOwe)}</p>
          <p className="kpi-card-sub">{owes.length} khoản nợ đang mở</p>
        </div>

        <div className="kpi-card" style={{ "--kpi-accent": "#059669" } as React.CSSProperties}>
          <div className="kpi-card-header">
            <div className="kpi-card-icon bg-emerald-100 text-emerald-600">
              <TrendingUp size={18} />
            </div>
            <span className="kpi-card-label text-emerald-700">Tổng nợ phải thu</span>
          </div>
          <p className="kpi-card-value text-emerald-600">{formatCurrency(totalOwed)}</p>
          <p className="kpi-card-sub">{oweds.length} khoản đang chờ thu</p>
        </div>
      </div>

      {/* Add Debt Action */}
      <DebtActions existingDebts={plainDebts} />

      {/* Debt Lists with Bulk Delete */}
      <DebtListClient owes={owes} oweds={oweds} />
    </div>
  );
}
