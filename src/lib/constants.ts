import { CategoryType } from "@prisma/client";

// ─────────────────────────────────────────
// Budget
// ─────────────────────────────────────────
export const BUDGET_WARNING_THRESHOLD = 0.8; // 80% → cảnh báo
export const BUDGET_DANGER_THRESHOLD = 1.0;  // 100% → nguy hiểm

// ─────────────────────────────────────────
// Màu sắc theo loại giao dịch / category
// ─────────────────────────────────────────
export const CATEGORY_TYPE_COLORS: Record<CategoryType, string> = {
  EXPENSE:  "#ef4444", // đỏ
  INCOME:   "#22c55e", // xanh lá
  INVEST:   "#3b82f6", // xanh dương
  DEBT:     "#f59e0b", // vàng
  SAVINGS:  "#8b5cf6", // tím
};

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  EXPENSE:  "Chi tiêu",
  INCOME:   "Thu nhập",
  INVEST:   "Đầu tư",
  DEBT:     "Nợ",
  SAVINGS:  "Tiết kiệm",
};

// ─────────────────────────────────────────
// Default categories (dùng khi seed user mới)
// ─────────────────────────────────────────
export const DEFAULT_CATEGORIES: {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  isDefault: boolean;
}[] = [
  // EXPENSE
  { name: "Ăn uống",      type: "EXPENSE", color: "#f97316", icon: "🍜", isDefault: true },
  { name: "Di chuyển",    type: "EXPENSE", color: "#eab308", icon: "🚗", isDefault: true },
  { name: "Mua sắm",      type: "EXPENSE", color: "#ec4899", icon: "🛍️", isDefault: true },
  { name: "Hóa đơn",      type: "EXPENSE", color: "#6366f1", icon: "🧾", isDefault: true },
  { name: "Giải trí",     type: "EXPENSE", color: "#06b6d4", icon: "🎬", isDefault: true },
  { name: "Sức khỏe",     type: "EXPENSE", color: "#10b981", icon: "💊", isDefault: true },
  { name: "Chi tiêu khác",type: "EXPENSE", color: "#94a3b8", icon: "📦", isDefault: true },
  // INCOME
  { name: "Lương",        type: "INCOME",  color: "#22c55e", icon: "💰", isDefault: true },
  { name: "Thưởng",       type: "INCOME",  color: "#16a34a", icon: "🎁", isDefault: true },
  { name: "Freelance",    type: "INCOME",  color: "#4ade80", icon: "💻", isDefault: true },
  { name: "Thu nhập khác",type: "INCOME",  color: "#86efac", icon: "📥", isDefault: true },
  // INVEST
  { name: "Chứng khoán",  type: "INVEST",  color: "#3b82f6", icon: "📈", isDefault: true },
  { name: "Crypto",       type: "INVEST",  color: "#f59e0b", icon: "₿",  isDefault: true },
  { name: "Vàng",         type: "INVEST",  color: "#fbbf24", icon: "🥇", isDefault: true },
  // DEBT
  { name: "Nợ phải trả",  type: "DEBT",    color: "#ef4444", icon: "📤", isDefault: true },
  { name: "Nợ phải thu",  type: "DEBT",    color: "#f59e0b", icon: "📩", isDefault: true },
  // SAVINGS
  { name: "Tiết kiệm",    type: "SAVINGS", color: "#8b5cf6", icon: "🏦", isDefault: true },
  { name: "Quỹ dự phòng", type: "SAVINGS", color: "#7c3aed", icon: "🛡️", isDefault: true },
];

// ─────────────────────────────────────────
// Navigation sidebar items
// ─────────────────────────────────────────
export const NAV_ITEMS = [
  { href: "/dashboard",    label: "Tổng quan",   icon: "LayoutDashboard" },
  { href: "/transactions", label: "Giao dịch",   icon: "ArrowLeftRight"  },
  { href: "/budget",       label: "Ngân sách",   icon: "Wallet"          },
  { href: "/investments",  label: "Đầu tư",      icon: "TrendingUp"      },
  { href: "/debts",        label: "Nợ",          icon: "HandCoins"       },
  { href: "/goals",        label: "Mục tiêu",    icon: "Target"          },
  { href: "/settings",     label: "Cài đặt",     icon: "Settings"        },
] as const;

// ─────────────────────────────────────────
// Bộ lọc thời gian
// ─────────────────────────────────────────
export const TIME_FILTER_OPTIONS = [
  { value: "today",   label: "Hôm nay"    },
  { value: "week",    label: "7 ngày"     },
  { value: "month",   label: "Tháng này"  },
  { value: "year",    label: "Năm này"    },
  { value: "custom",  label: "Tùy chọn"  },
] as const;

export type TimeFilter = (typeof TIME_FILTER_OPTIONS)[number]["value"];
