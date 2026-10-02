"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toInstant, toDate, serializeData } from "@/lib/utils";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export interface WalletCashItem {
  id: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  balance: number;
  color: string;
  icon: string;
  tier: "INSTANT" | "SAVINGS";
  percentOfTotal: number;
}

export interface CashFlowData {
  success: boolean;
  // Vị thế tiền mặt & Thanh khoản tức thời
  totalLiquidCash: number;
  totalSavingsAndEmergency: number;
  totalReceivables: number; // Người khác nợ mình
  totalPayables: number;    // Mình nợ người khác
  netAvailableCash: number; // Tiền mặt thực tế khả dụng sau khi bù trừ nợ

  // Runway & Tốc độ tiêu tiền
  monthlyBurnRate: number;  // Chi tiêu TB mỗi tháng
  averageMonthlyIncome: number; // Thu nhập TB mỗi tháng
  netMonthlyCashFlow: number;   // Dòng tiền ròng mỗi tháng (Inflow - Outflow)
  runwayMonths: number;     // Số tháng sống sót bằng tiền mặt hiện có
  runwayStatus: {
    level: "CRITICAL" | "WARNING" | "STANDARD" | "SECURE" | "EXCELLENT";
    label: string;
    color: string;
    desc: string;
  };

  // Cam kết dòng tiền & Dòng tiền tự do (Free Cash Flow)
  fixedMonthlyCommitments: number; // Ngân sách thiết yếu + Nợ đến hạn
  monthlyFreeCashFlow: number;     // Dòng tiền tự do để tái đầu tư / tích lũy
  fcfMargin: number;               // % Dòng tiền tự do trên thu nhập

  // Cấu trúc phân bổ dòng tiền
  liquidityTiers: {
    tier1Instant: number;    // Tiền mặt & tài khoản thanh toán tức thời
    tier2Savings: number;    // Tiền gửi tiết kiệm & quỹ khẩn cấp
    tier3Receivables: number;// Khoản cho vay sắp thu hồi
    tier4Investments: number;// Danh mục đầu tư sinh lời
    totalWealth: number;
  };

  // Chi tiết từng ví & tài khoản
  wallets: WalletCashItem[];

  // Khoản phải thu & phải trả nổi bật
  topReceivables: { id: string; person: string; amount: number; remain: number; dueDate: string | null }[];
  topPayables: { id: string; person: string; amount: number; remain: number; dueDate: string | null }[];

  // Đầu tư & Mục tiêu
  totalInvestments: number;
  totalGoalsSaved: number;

  // Gợi ý thông minh cải thiện dòng tiền
  insights: { title: string; desc: string; type: "tip" | "warning" | "success" }[];
}

/**
 * Lấy dữ liệu toàn diện về DÒNG TIỀN HIỆN CÓ:
 * Nắm bắt chính xác hiện có bao nhiêu tiền mặt, tiền nằm ở đâu,
 * sức chịu đựng (Runway), cam kết định kỳ và dòng tiền tự do.
 */
export async function getCashFlowData(): Promise<CashFlowData> {
  const userId = await getUserId();
  const now = new Date();

  // Mốc 90 ngày gần nhất để tính TB chi tiêu & thu nhập
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const ninetyDaysInstant = toInstant(ninetyDaysAgo);

  const [wallets, debts, investments, goals, recentTransactions, budgets] = await Promise.all([
    // Tất cả ví
    db.orm.public.Wallet.where((w) => w.userId.eq(userId)).all(),

    // Tất cả khoản nợ
    db.orm.public.Debt.where((d) => d.userId.eq(userId)).all(),

    // Danh mục đầu tư
    db.orm.public.Investment.where((i) => i.userId.eq(userId)).all(),

    // Mục tiêu tích lũy
    db.orm.public.Goal.where((g) => g.userId.eq(userId)).all(),

    // Giao dịch 90 ngày gần đây
    db.orm.public.Transaction
      .where((t) => t.userId.eq(userId))
      .where((t) => t.recordedAt.gte(ninetyDaysInstant))
      .all(),

    // Ngân sách tháng hiện tại
    db.orm.public.Budget
      .where((b) => b.userId.eq(userId))
      .where((b) => b.month.eq(now.getMonth() + 1))
      .where((b) => b.year.eq(now.getFullYear()))
      .all(),
  ]);

  // 1. Phân loại ví tiền & Tính tổng tiền mặt
  let instantCash = 0;
  let savingsCash = 0;

  const rawWallets = (wallets as any[]).map((w) => {
    const bal = Number(w.currentBalance ?? w.balance ?? 0);
    const nameLower = (w.name || "").toLowerCase();
    const isSavings =
      nameLower.includes("tiết kiệm") ||
      nameLower.includes("dự phòng") ||
      nameLower.includes("saving") ||
      nameLower.includes("khẩn cấp");

    if (bal > 0) {
      if (isSavings) {
        savingsCash += bal;
      } else {
        instantCash += bal;
      }
    }

    return {
      id: w.id,
      name: w.name,
      bankName: w.bankName ?? null,
      accountNumber: w.accountNumber ?? null,
      balance: bal,
      color: w.color || "#7c3aed",
      icon: w.icon || "Landmark",
      tier: (isSavings ? "SAVINGS" : "INSTANT") as "INSTANT" | "SAVINGS",
      percentOfTotal: 0,
    };
  });

  const totalLiquidCash = Math.max(0, instantCash);
  const totalSavingsAndEmergency = Math.max(0, savingsCash);
  const totalAllCash = totalLiquidCash + totalSavingsAndEmergency;

  const processedWallets: WalletCashItem[] = rawWallets.map((w) => ({
    ...w,
    percentOfTotal: totalAllCash > 0 ? Math.round((Math.max(0, w.balance) / totalAllCash) * 100) : 0,
  })).sort((a, b) => b.balance - a.balance);

  // 2. Tính toán Nợ & Cho vay (Receivables vs Payables)
  let totalReceivables = 0;
  let totalPayables = 0;
  const topReceivables: any[] = [];
  const topPayables: any[] = [];

  for (const d of debts as any[]) {
    const amount = Number(d.amount);
    const paid = Number(d.paidAmount ?? 0);
    const remain = Math.max(0, amount - paid);

    if (d.status !== "PAID" && remain > 0) {
      if (d.direction === "OWED") {
        totalReceivables += remain;
        topReceivables.push({
          id: d.id,
          person: d.person,
          amount,
          remain,
          dueDate: d.dueDate ? toDate(d.dueDate).toISOString() : null,
        });
      } else {
        totalPayables += remain;
        topPayables.push({
          id: d.id,
          person: d.person,
          amount,
          remain,
          dueDate: d.dueDate ? toDate(d.dueDate).toISOString() : null,
        });
      }
    }
  }

  topReceivables.sort((a, b) => b.remain - a.remain);
  topPayables.sort((a, b) => b.remain - a.remain);

  // 3. Tính Giá trị Đầu tư
  const totalInvestments = (investments as any[]).reduce((sum, inv) => {
    const price = inv.currentPrice ?? inv.buyPrice ?? 0;
    return sum + Number(price) * Number(inv.quantity);
  }, 0);

  // 4. Mục tiêu tích lũy
  const totalGoalsSaved = (goals as any[]).reduce(
    (sum, g) => sum + Number(g.savedAmount ?? 0),
    0
  );

  // 5. Tính Burn Rate & Thu nhập TB hàng tháng từ 90 ngày gần nhất
  let total90dIncome = 0;
  let total90dExpense = 0;

  for (const tx of recentTransactions as any[]) {
    const amt = Number(tx.amount);
    if (tx.type === "INCOME") {
      total90dIncome += amt;
    } else if (tx.type === "EXPENSE") {
      total90dExpense += amt;
    }
  }

  // Chia 3 tháng (nếu chưa đủ 90 ngày thì tối thiểu tính 1 tháng)
  const averageMonthlyIncome = Math.round(total90dIncome / 3);
  let monthlyBurnRate = Math.round(total90dExpense / 3);

  // Nếu chưa có giao dịch chi tiêu trong 90 ngày, lấy tổng ngân sách tháng làm mốc chi tiêu tham chiếu
  const totalMonthlyBudget = (budgets as any[]).reduce(
    (sum, b) => sum + Number(b.limitAmount ?? 0),
    0
  );

  if (monthlyBurnRate <= 0 && totalMonthlyBudget > 0) {
    monthlyBurnRate = totalMonthlyBudget;
  }

  const netMonthlyCashFlow = averageMonthlyIncome - monthlyBurnRate;

  // 6. Cash Runway (Số tháng tồn tại bằng tiền mặt)
  const availableCashForRunway = totalLiquidCash + totalSavingsAndEmergency;
  let runwayMonths = 0;
  if (monthlyBurnRate > 0) {
    runwayMonths = Number((availableCashForRunway / monthlyBurnRate).toFixed(1));
  } else if (availableCashForRunway > 0) {
    runwayMonths = 99; // Không có chi tiêu
  }

  let runwayStatus: CashFlowData["runwayStatus"];
  if (runwayMonths < 1) {
    runwayStatus = {
      level: "CRITICAL",
      label: "Báo động đỏ (< 1 tháng)",
      color: "#ef4444",
      desc: "Tiền mặt hiện có chỉ đủ chi tiêu dưới 1 tháng. Bạn đang ở vùng rủi ro thanh khoản cao!",
    };
  } else if (runwayMonths < 3) {
    runwayStatus = {
      level: "WARNING",
      label: "Cảnh báo (1 - 3 tháng)",
      color: "#f59e0b",
      desc: "Đệm tiền mặt tương đối mỏng. Cần hạn chế mua sắm tùy ý và ưu tiên bổ sung quỹ dự phòng.",
    };
  } else if (runwayMonths < 6) {
    runwayStatus = {
      level: "STANDARD",
      label: "Cơ bản (3 - 6 tháng)",
      color: "#3b82f6",
      desc: "Đạt chuẩn đệm thanh khoản sinh tồn cơ bản. Đủ khả năng vượt qua sự cố tài chính đột xuất.",
    };
  } else if (runwayMonths < 12) {
    runwayStatus = {
      level: "SECURE",
      label: "An toàn (6 - 12 tháng)",
      color: "#10b981",
      desc: "Dòng tiền rất vững chãi. Bạn hoàn toàn có thể yên tâm sinh sống trong nửa năm tới.",
    };
  } else {
    runwayStatus = {
      level: "EXCELLENT",
      label: "Độc lập tài chính (> 12 tháng)",
      color: "#8b5cf6",
      desc: "Sức mạnh tiền mặt tuyệt vời! Tiền nhàn rỗi dồi dào, sẵn sàng cho các cơ hội đầu tư dài hạn.",
    };
  }

  // 7. Cam kết dòng tiền & Dòng tiền tự do
  const fixedMonthlyCommitments = totalMonthlyBudget > 0 ? totalMonthlyBudget : monthlyBurnRate;
  const monthlyFreeCashFlow = Math.max(0, averageMonthlyIncome - fixedMonthlyCommitments);
  const fcfMargin =
    averageMonthlyIncome > 0
      ? Math.round((monthlyFreeCashFlow / averageMonthlyIncome) * 100)
      : 0;

  // 8. Vị thế tiền mặt ròng
  const netAvailableCash = totalAllCash + totalReceivables - totalPayables;

  // 9. Cấu trúc thanh khoản
  const totalWealth =
    totalLiquidCash + totalSavingsAndEmergency + totalReceivables + totalInvestments;

  // 10. Gợi ý hành động thực tế
  const insights: CashFlowData["insights"] = [];

  if (runwayMonths < 3) {
    insights.push({
      title: "Ưu tiên xây dựng đệm tiền mặt khẩn cấp",
      desc: `Runway hiện tại là ${runwayMonths} tháng. Hãy tích lũy ít nhất 3 tháng chi phí (${(monthlyBurnRate * 3).toLocaleString("vi-VN")} ₫) vào ví tiết kiệm trước khi đầu tư rủi ro.`,
      type: "warning",
    });
  }

  if (totalReceivables > totalLiquidCash * 0.3 && totalReceivables > 0) {
    insights.push({
      title: "Đẩy nhanh tiến độ thu hồi các khoản cho vay",
      desc: `Người khác đang mượn bạn ${totalReceivables.toLocaleString("vi-VN")} ₫ (chiếm ${(totalAllCash > 0 ? (totalReceivables / totalAllCash) * 100 : 0).toFixed(0)}% lượng tiền mặt). Thu hồi sớm sẽ giúp tăng mạnh tính thanh khoản.`,
      type: "tip",
    });
  }

  if (totalPayables > 0 && totalPayables > totalLiquidCash * 0.5) {
    insights.push({
      title: "Áp lực nghĩa vụ trả nợ đáng chú ý",
      desc: `Bạn đang có ${totalPayables.toLocaleString("vi-VN")} ₫ nợ cần thanh toán. Hãy lập kế hoạch trả nợ định kỳ để tránh áp lực lãi suất phát sinh.`,
      type: "warning",
    });
  }

  if (monthlyFreeCashFlow > 0) {
    insights.push({
      title: "Dòng tiền tự do dương (Free Cash Flow)",
      desc: `Mỗi tháng bạn dôi dư khoảng ${monthlyFreeCashFlow.toLocaleString("vi-VN")} ₫ (${fcfMargin}% thu nhập). Đây là nguồn vốn vàng để đầu tư sinh lời hoặc gia tăng tài sản.`,
      type: "success",
    });
  }

  if (instantCash > monthlyBurnRate * 6 && monthlyBurnRate > 0) {
    insights.push({
      title: "Tối ưu hóa số dư tiền nhàn rỗi",
      desc: `Ví tiền mặt & tài khoản thanh toán đang giữ ${instantCash.toLocaleString("vi-VN")} ₫ (vượt quá 6 tháng chi tiêu). Bạn có thể chuyển bớt vào tiền gửi có kỳ hạn hoặc kênh đầu tư để tránh lạm phát.`,
      type: "tip",
    });
  }

  return serializeData({
    success: true,
    totalLiquidCash,
    totalSavingsAndEmergency,
    totalReceivables,
    totalPayables,
    netAvailableCash,
    monthlyBurnRate,
    averageMonthlyIncome,
    netMonthlyCashFlow,
    runwayMonths,
    runwayStatus,
    fixedMonthlyCommitments,
    monthlyFreeCashFlow,
    fcfMargin,
    liquidityTiers: {
      tier1Instant: totalLiquidCash,
      tier2Savings: totalSavingsAndEmergency,
      tier3Receivables: totalReceivables,
      tier4Investments: totalInvestments,
      totalWealth,
    },
    wallets: processedWallets,
    topReceivables,
    topPayables,
    totalInvestments,
    totalGoalsSaved,
    insights,
  });
}

// Giữ lại alias để tương thích nếu nơi nào gọi getIncomePageData
export async function getIncomePageData() {
  return getCashFlowData();
}
