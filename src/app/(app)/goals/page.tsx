import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWallets } from "@/actions/wallets";
import { formatCurrency, calcPercent, formatMetric, toDate, serializeData } from "@/lib/utils";
import { Target, TrendingUp, PiggyBank } from "lucide-react";
import { GoalsClient } from "./goals-client";

export default async function GoalsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  try {
    const [goals, wallets] = await Promise.all([
      db.orm.public.Goal
        .where((g) => g.userId.eq(userId))
        .include("contributions", (tx) => tx)
        .orderBy((g) => g.createdAt.desc())
        .all(),
      getWallets(),
    ]);

    const totalTarget = goals.reduce((sum, g) => sum + Number(g.targetAmount), 0);
    const totalSaved = goals.reduce((sum, g) => sum + Number(g.savedAmount), 0);
    const overallPercent = calcPercent(totalSaved, totalTarget);

    const formattedGoals = goals.map((g: any) => ({
      id: g.id,
      name: g.name,
      targetAmount: Number(g.targetAmount),
      savedAmount: Number(g.savedAmount),
      deadline: g.deadline ? toDate(g.deadline).toISOString() : null,
      note: g.note ?? null,
      contributions: ((g.contributions as any[]) || [])
        .map((c: any) => ({
          id: c.id,
          amount: Number(c.amount),
          note: c.note ?? null,
          recordedAt: toDate(c.recordedAt).toISOString(),
        }))
        .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()),
    }));

    return (
      <div className="space-y-6 animate-fade-in w-full">
        {/* Page Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shadow-sm">
              <Target size={20} />
            </div>
            <div>
              <h1 className="page-header-title">Mục tiêu & Tiết kiệm</h1>
              <p className="page-header-subtitle">Lập kế hoạch tích lũy, trích tiền từ ví và theo dõi tiến độ hoàn thành các dự định</p>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
          <div className="kpi-card" style={{ "--kpi-accent": "var(--savings)" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className="kpi-card-icon bg-purple-100 text-purple-600">
                <Target size={18} />
              </div>
              <span className="kpi-card-label text-purple-700">Tổng mục tiêu</span>
            </div>
            <p className="kpi-card-value text-foreground">{formatCurrency(totalTarget)}</p>
            <p className="kpi-card-sub">{goals.length} mục tiêu đang theo dõi</p>
          </div>

          <div className="kpi-card" style={{ "--kpi-accent": "#059669" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className="kpi-card-icon bg-emerald-100 text-emerald-600">
                <PiggyBank size={18} />
              </div>
              <span className="kpi-card-label text-emerald-700">Đã tích lũy</span>
            </div>
            <p className="kpi-card-value text-emerald-600">{formatCurrency(totalSaved)}</p>
            <p className="kpi-card-sub">Tiến độ tổng: {formatMetric(overallPercent)}%</p>
          </div>

          <div className="kpi-card" style={{ "--kpi-accent": "var(--brand)" } as React.CSSProperties}>
            <div className="kpi-card-header">
              <div className="kpi-card-icon bg-orange-100 text-orange-600">
                <TrendingUp size={18} />
              </div>
              <span className="kpi-card-label text-orange-700">Tiến độ chung</span>
            </div>
            <p className="kpi-card-value text-orange-600">{formatMetric(overallPercent)}%</p>
            <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-orange-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(overallPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <GoalsClient goals={serializeData(formattedGoals)} wallets={wallets as any[]} />
      </div>
    );
  } catch (error) {
    console.error(error);
    return (
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <p className="empty-state-title text-rose-600">Đã xảy ra lỗi khi tải dữ liệu mục tiêu.</p>
      </div>
    );
  }
}
