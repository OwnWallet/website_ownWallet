import {
  User,
  Category,
  Transaction,
  Budget,
  Investment,
  InvestLog,
  Debt,
  Goal,
  CategoryType,
  TxType,
  DebtDir,
  DebtStatus,
  InvestAction,
} from "@prisma/client";

// Re-export Prisma types
export type {
  User,
  Category,
  Transaction,
  Budget,
  Investment,
  InvestLog,
  Debt,
  Goal,
  CategoryType,
  TxType,
  DebtDir,
  DebtStatus,
  InvestAction,
};

// ─── Composed types (with relations) ──────────────────────────

export type TransactionWithCategory = Transaction & {
  category: Category;
};

export type BudgetWithCategory = Budget & {
  category: Category;
};

export type InvestmentWithLogs = Investment & {
  logs: InvestLog[];
};

export type GoalWithContributions = Goal & {
  contributions: Transaction[];
};

// ─── Computed types ────────────────────────────────────────────

/** Tóm tắt tài chính dùng cho Dashboard KPI */
export type FinancialSummary = {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  totalInvested: number;
  totalInvestPnL: number; // Lãi/lỗ đầu tư
  totalDebtOwe: number;   // Tổng tôi đang nợ
  totalDebtOwed: number;  // Tổng người đang nợ tôi
};

/** Dữ liệu 1 điểm trên bar chart */
export type ChartDataPoint = {
  date: string;
  income: number;
  expense: number;
};

/** Server Action response chuẩn */
export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { error: string | Record<string, string[]> };

// ─── Session extension ─────────────────────────────────────────
// Mở rộng NextAuth Session để có user.id
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
    };
  }
}
