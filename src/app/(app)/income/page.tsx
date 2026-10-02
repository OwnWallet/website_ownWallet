import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCashFlowData } from "@/actions/income";
import { getCashFlowSources } from "@/actions/cash-flow";
import { CashFlowManager } from "./cash-flow-manager";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import {
  Banknote,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Plus,
  ArrowRight,
  HandCoins,
  Receipt,
  Layers,
} from "lucide-react";

export const metadata = {
  title: "Quản trị Dòng tiền | OwnWallet",
  description: "Dòng tiền tương lai (tiền lương, đầu tư sinh dòng tiền), vị thế tiền mặt & đệm an toàn tài chính",
};

export default async function CashFlowPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let data: Awaited<ReturnType<typeof getCashFlowData>>;
  let sourcesData: Awaited<ReturnType<typeof getCashFlowSources>>;

  try {
    const [fetchedData, fetchedSources] = await Promise.all([
      getCashFlowData(),
      getCashFlowSources(),
    ]);
    data = fetchedData;
    sourcesData = fetchedSources;
  } catch (error) {
    console.error("Failed to fetch cash flow data:", error);
    return (
      <div className="empty-state py-12">
        <span className="empty-state-icon text-3xl">⚠️</span>
        <p className="empty-state-title text-rose-600 font-bold mt-2">
          Không thể tải dữ liệu dòng tiền. Vui lòng thử lại sau.
        </p>
      </div>
    );
  }

  const totalAllCash = data.totalLiquidCash + data.totalSavingsAndEmergency;

  return (
    <div className="space-y-7 animate-fade-in w-full pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Banknote size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Quản trị Dòng tiền
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Kế hoạch dòng tiền tương lai (lương, cổ tức đầu tư), thanh khoản & đệm sinh tồn tài chính
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/wallets"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground transition-all shadow-2xs flex items-center gap-1.5"
          >
            <Wallet size={14} className="text-muted-foreground" />
            <span>Ví & Tài khoản</span>
          </Link>
          <Link
            href="/debts"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground transition-all shadow-2xs flex items-center gap-1.5"
          >
            <HandCoins size={14} className="text-amber-500" />
            <span>Sổ nợ</span>
          </Link>
          <Link
            href="/transactions/new"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Ghi thu / chi</span>
          </Link>
        </div>
      </div>

      {/* Banner Vị Thế Tiền Mặt Ròng Sau Bù Trừ Nợ & Dòng Tiền Tương Lai */}
      <div className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Net Cash Position
              </span>
              <span className="text-xs text-slate-400">Vị thế tiền mặt thực tế sau bù trừ</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white pt-1">
              {formatCurrency(data.netAvailableCash)}
            </h2>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Tổng tiền mặt thực sự thuộc về bạn sau khi tính các khoản người khác nợ sắp thu về và trừ đi các nghĩa vụ nợ phải thanh toán.
            </p>
          </div>

          {/* Công thức đối chiếu trực quan */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap bg-slate-800/80 p-3.5 sm:p-4 rounded-xl border border-slate-700/70 text-xs">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Tổng tiền mặt</p>
              <p className="text-sm font-bold text-white mt-0.5">{formatCurrencyCompact(totalAllCash)}</p>
            </div>
            <span className="text-emerald-400 font-bold text-base">+</span>
            <div>
              <p className="text-[10px] text-emerald-400 uppercase font-semibold">Người nợ mình</p>
              <p className="text-sm font-bold text-emerald-300 mt-0.5">{formatCurrencyCompact(data.totalReceivables)}</p>
            </div>
            <span className="text-rose-400 font-bold text-base">−</span>
            <div>
              <p className="text-[10px] text-rose-400 uppercase font-semibold">Mình nợ người</p>
              <p className="text-sm font-bold text-rose-300 mt-0.5">{formatCurrencyCompact(data.totalPayables)}</p>
            </div>
            {sourcesData.summary.totalExpectedThisMonth > 0 && (
              <>
                <span className="text-blue-400 font-bold text-base hidden sm:inline">|</span>
                <div className="pl-1 sm:pl-2">
                  <p className="text-[10px] text-blue-400 uppercase font-semibold">Dự kiến về T{new Date().getMonth() + 1}</p>
                  <p className="text-sm font-extrabold text-blue-300 mt-0.5">+{formatCurrencyCompact(sourcesData.summary.totalExpectedThisMonth)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KHỐI TRỌNG TÂM: QUẢN TRỊ DÒNG TIỀN TƯƠNG LAI (LƯƠNG, CỔ TỨC ĐẦU TƯ, THUÊ NHÀ) */}
      <div className="space-y-4">
        <CashFlowManager sourcesData={sourcesData} />
      </div>

      {/* KHỐI CẤP ĐỘ THANH KHOẢN VÀ CÂN BẰNG DÒNG TIỀN HÀNG THÁNG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Cột 1: 4 Cấp độ Thanh khoản Tài chính */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Layers size={18} className="text-teal-600" />
                <span>4 Cấp độ Thanh khoản Tài sản</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Đánh giá mức độ chuyển đổi thành tiền mặt của toàn bộ tài sản
              </p>
            </div>
            <span className="text-xs font-extrabold text-foreground">
              Tổng: {formatCurrencyCompact(data.liquidityTiers.totalWealth)}
            </span>
          </div>

          <div className="space-y-3">
            {/* Cấp 1 */}
            <div className="p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <p className="text-xs font-bold text-foreground">Cấp 1 · Tiền mặt tức thời</p>
                </div>
                <p className="text-[11px] text-muted-foreground">Ví tiền, tài khoản thanh toán ({data.wallets.filter((w) => w.tier === "INSTANT").length} tài khoản)</p>
              </div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(data.liquidityTiers.tier1Instant)}
              </p>
            </div>

            {/* Cấp 2 */}
            <div className="p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/40 dark:bg-purple-950/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <p className="text-xs font-bold text-foreground">Cấp 2 · Tiền gửi & Quỹ dự phòng</p>
                </div>
                <p className="text-[11px] text-muted-foreground">Tiết kiệm có kỳ hạn, quỹ khẩn cấp sinh tồn</p>
              </div>
              <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                {formatCurrency(data.liquidityTiers.tier2Savings)}
              </p>
            </div>

            {/* Cấp 3 */}
            <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/40 dark:bg-blue-950/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <p className="text-xs font-bold text-foreground">Cấp 3 · Cho vay sắp thu hồi</p>
                </div>
                <p className="text-[11px] text-muted-foreground">Khoản người khác nợ (Thu hồi theo sổ nợ)</p>
              </div>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(data.liquidityTiers.tier3Receivables)}
              </p>
            </div>

            {/* Cấp 4 */}
            <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <p className="text-xs font-bold text-foreground">Cấp 4 · Tài sản đầu tư sinh lời</p>
                </div>
                <p className="text-[11px] text-muted-foreground">Cổ phiếu, vàng, crypto ({sourcesData.investments.length} danh mục)</p>
              </div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                {formatCurrency(data.liquidityTiers.tier4Investments)}
              </p>
            </div>
          </div>

          {/* Phân bổ tỷ trọng tiền mặt tinh gọn (không lặp lại thẻ ngân hàng) */}
          {data.wallets.length > 0 && (
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Tỷ trọng tiền mặt giữa các ví:</span>
                <Link href="/wallets" className="text-primary font-bold hover:underline flex items-center gap-1">
                  <span>Quản lý ví</span>
                  <ArrowRight size={11} />
                </Link>
              </div>

              <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-2xs">
                {data.wallets.map((w) => (
                  <div
                    key={w.id}
                    title={`${w.name}: ${formatCurrency(w.balance)} (${w.percentOfTotal}%)`}
                    style={{
                      width: `${w.percentOfTotal}%`,
                      backgroundColor: w.color,
                    }}
                    className="h-full transition-all duration-500 hover:opacity-85"
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                {data.wallets.slice(0, 4).map((w) => (
                  <div key={w.id} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                    <span className="truncate max-w-[100px]">{w.name}</span>
                    <strong className="text-foreground">{w.percentOfTotal}%</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cột 2: Cân bằng Dòng tiền Hàng tháng & Gợi ý Thông Minh */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Receipt size={18} className="text-orange-500" />
                  <span>Cân bằng Dòng tiền Hàng tháng</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Đối chiếu dòng tiền vào dự kiến và tốc độ chi tiêu
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <ArrowDownRight size={14} />
                  <span>Dòng tiền vào TB</span>
                </div>
                <p className="text-lg font-black text-foreground">
                  +{formatCurrency(data.averageMonthlyIncome)}
                </p>
                <p className="text-[10px] text-muted-foreground">Thực tế 3 tháng gần nhất</p>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <ArrowUpRight size={14} />
                  <span>Mức chi tiêu TB</span>
                </div>
                <p className="text-lg font-black text-foreground">
                  −{formatCurrency(data.monthlyBurnRate)}
                </p>
                <p className="text-[10px] text-muted-foreground">Tốc độ tiêu tiền hàng tháng</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/40 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Dòng tiền dôi dư ròng (Net FCF):</span>
                <strong
                  className={`font-black text-sm ${
                    data.netMonthlyCashFlow >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {data.netMonthlyCashFlow >= 0 ? "+" : ""}
                  {formatCurrency(data.netMonthlyCashFlow)} /tháng
                </strong>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Cash Runway sinh tồn:</span>
                <span className="font-bold text-foreground">
                  {data.runwayMonths >= 99 ? "Vô hạn" : `${data.runwayMonths} tháng`} ({data.runwayStatus.label})
                </span>
              </div>
            </div>
          </div>

          {/* Gợi ý Tối ưu hóa Dòng tiền */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Lightbulb size={18} className="text-amber-500" />
              <h3 className="font-bold text-base text-foreground">Gợi ý Tối ưu Dòng tiền</h3>
            </div>

            <div className="space-y-2.5">
              {data.insights.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Dòng tiền của bạn đang ở trạng thái cân bằng rất tốt!</span>
                </div>
              ) : (
                data.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-0.5 ${
                      insight.type === "warning"
                        ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 text-rose-950 dark:text-rose-200"
                        : insight.type === "success"
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 text-emerald-950 dark:text-emerald-200"
                        : "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 text-amber-950 dark:text-amber-200"
                    }`}
                  >
                    <p className="font-bold flex items-center gap-1.5">
                      {insight.type === "warning" ? (
                        <AlertTriangle size={13} className="text-rose-500 shrink-0" />
                      ) : insight.type === "success" ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : (
                        <Lightbulb size={13} className="text-amber-500 shrink-0" />
                      )}
                      <span>{insight.title}</span>
                    </p>
                    <p className="text-[11px] leading-relaxed opacity-90 pl-4">{insight.desc}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
