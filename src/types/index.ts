// Prisma 8 — types được infer trực tiếp từ contract, không import từ @prisma/client
// Dùng type inference từ db object hoặc tự định nghĩa

// ─── Enum types ─────────────────────────────────────────────────
export type CategoryType = "EXPENSE" | "INCOME" | "INVEST" | "DEBT" | "SAVINGS";
export type TxType = "INCOME" | "EXPENSE";
export type DebtDir = "OWE" | "OWED";
export type DebtStatus = "PENDING" | "PARTIAL" | "PAID";
export type InvestAction = "BUY" | "SELL";

// ─── Model types ─────────────────────────────────────────────────
export type User = {
  id: string;
  email: string;
  name: string | null;
  password: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string | null;
  isDefault: boolean;
  createdAt: Date;
  userId: string;
};

export type Transaction = {
  id: string;
  amount: number;
  note: string | null;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  type: TxType;
  categoryId: string;
  goalId: string | null;
  userId: string;
};

export type Budget = {
  id: string;
  limitAmount: number;
  month: number;
  year: number;
  categoryId: string;
  userId: string;
};

export type Investment = {
  id: string;
  name: string;
  ticker: string | null;
  quantity: number;
  buyPrice: number;
  currentPrice: number | null;
  boughtAt: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
};

export type InvestLog = {
  id: string;
  action: InvestAction;
  quantity: number;
  price: number;
  recordedAt: Date;
  createdAt: Date;
  investmentId: string;
};

export type Debt = {
  id: string;
  person: string;
  amount: number;
  paidAmount: number;
  direction: DebtDir;
  status: DebtStatus;
  dueDate: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
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
