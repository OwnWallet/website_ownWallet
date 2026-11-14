import type { CategoryType } from "@/types";

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
// Default categories (dùng khi seed user mới và gợi ý chuẩn)
// ─────────────────────────────────────────
export const DEFAULT_CATEGORIES: {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  isDefault: boolean;
}[] = [
  // EXPENSE (12)
  { name: "Ăn uống",               type: "EXPENSE", color: "#f97316", icon: "🍜", isDefault: true },
  { name: "Di chuyển",             type: "EXPENSE", color: "#eab308", icon: "🚗", isDefault: true },
  { name: "Mua sắm",               type: "EXPENSE", color: "#ec4899", icon: "🛍️", isDefault: true },
  { name: "Hóa đơn",               type: "EXPENSE", color: "#6366f1", icon: "🧾", isDefault: true },
  { name: "Nhà ở & Tiền trọ",      type: "EXPENSE", color: "#d97706", icon: "🏠", isDefault: true },
  { name: "Giáo dục & Học tập",    type: "EXPENSE", color: "#0284c7", icon: "🎓", isDefault: true },
  { name: "Làm đẹp & Bản thân",    type: "EXPENSE", color: "#f43f5e", icon: "✂️", isDefault: true },
  { name: "Giải trí",              type: "EXPENSE", color: "#06b6d4", icon: "🎬", isDefault: true },
  { name: "Sức khỏe",              type: "EXPENSE", color: "#10b981", icon: "💊", isDefault: true },
  { name: "Bảo hiểm",              type: "EXPENSE", color: "#64748b", icon: "🛡️", isDefault: true },
  { name: "Từ thiện & Quà tặng",   type: "EXPENSE", color: "#fb7185", icon: "🎁", isDefault: true },
  { name: "Chi tiêu khác",         type: "EXPENSE", color: "#94a3b8", icon: "📦", isDefault: true },

  // INCOME (6)
  { name: "Lương",                 type: "INCOME",  color: "#22c55e", icon: "💰", isDefault: true },
  { name: "Thưởng",                type: "INCOME",  color: "#16a34a", icon: "🎁", isDefault: true },
  { name: "Freelance",             type: "INCOME",  color: "#4ade80", icon: "💻", isDefault: true },
  { name: "Hỗ trợ & Trợ cấp",      type: "INCOME",  color: "#059669", icon: "👨‍👩‍👦", isDefault: true },
  { name: "Lợi tức đầu tư",        type: "INCOME",  color: "#0ea5e9", icon: "📈", isDefault: true },
  { name: "Thu nhập khác",         type: "INCOME",  color: "#86efac", icon: "📥", isDefault: true },

  // INVEST (4)
  { name: "Chứng khoán",           type: "INVEST",  color: "#3b82f6", icon: "📈", isDefault: true },
  { name: "Crypto",                type: "INVEST",  color: "#f59e0b", icon: "₿",  isDefault: true },
  { name: "Vàng",                  type: "INVEST",  color: "#fbbf24", icon: "🥇", isDefault: true },
  { name: "Bất động sản",          type: "INVEST",  color: "#ca8a04", icon: "🏢", isDefault: true },

  // DEBT (2)
  { name: "Nợ phải trả",           type: "DEBT",    color: "#ef4444", icon: "📤", isDefault: true },
  { name: "Nợ phải thu",           type: "DEBT",    color: "#f59e0b", icon: "📩", isDefault: true },

  // SAVINGS (2)
  { name: "Tiết kiệm",             type: "SAVINGS", color: "#8b5cf6", icon: "🏦", isDefault: true },
  { name: "Quỹ dự phòng",          type: "SAVINGS", color: "#7c3aed", icon: "🛡️", isDefault: true },
];

// ─────────────────────────────────────────
// Chi tiết Tag cho từng Danh mục tài chính
// (Trích xuất chuẩn hóa từ thói quen chi tiêu thực tế của người dùng)
// ─────────────────────────────────────────
export const CATEGORY_TAGS: Record<string, string[]> = {
  // EXPENSE
  "Ăn uống": [
    "Bánh mì",
    "Cơm phần",
    "Bún bò",
    "Phở",
    "Mỳ quảng",
    "Cà phê",
    "Ăn sáng",
    "Ăn trưa",
    "Ăn tối",
    "Ăn vặt",
    "Trà sữa",
    "Đi chợ",
    "Siêu thị",
    "Nhậu",
    "Jollibee",
    "Fastfood",
    "Nước mía",
    "Trái cây",
    "Giao đồ ăn",
  ],
  "Di chuyển": [
    "Đổ xăng",
    "Gửi xe",
    "Grab",
    "Xanh SM",
    "Be",
    "Taxi",
    "Sửa xe",
    "Bơm lốp",
    "Thay nhớt",
    "Rửa xe",
    "Vé cầu đường",
    "Vé máy bay",
    "Vé xe buýt",
    "Vé tàu",
  ],
  "Mua sắm": [
    "Quần áo",
    "Shopee",
    "Coolmate",
    "Giày dép",
    "Mỹ phẩm",
    "Đồ điện tử",
    "Tai nghe",
    "Phụ kiện",
    "Đồ gia dụng",
    "Sách vở",
    "Văn phòng phẩm",
    "Đồ cá nhân",
  ],
  "Hóa đơn": [
    "Tiền điện",
    "Tiền nước",
    "Internet",
    "Wifi",
    "Nạp tiền điện thoại",
    "4G",
    "Phí quản lý",
    "Netflix",
    "Spotify",
    "iCloud",
    "Phí AWS",
    "Server",
  ],
  "Nhà ở & Tiền trọ": [
    "Tiền phòng",
    "Tiền trọ",
    "Tiền cọc phòng",
    "Tiền thuê nhà",
    "Sửa chữa nhà",
    "Nội thất",
    "Đồ dùng bếp",
    "Dọn dẹp vệ sinh",
  ],
  "Giáo dục & Học tập": [
    "Học Udemy",
    "Khóa học",
    "Học phí",
    "Sách chuyên ngành",
    "Chứng chỉ",
    "Đồ học tập",
    "Học tiếng Anh",
    "Gia sư",
  ],
  "Làm đẹp & Bản thân": [
    "Cắt tóc",
    "Barber",
    "Chăm sóc da",
    "Spa",
    "Làm móng",
    "Nước hoa",
    "Chăm sóc cá nhân",
  ],
  "Giải trí": [
    "Đá bóng",
    "Sân bóng",
    "Xem phim",
    "CGV",
    "Du lịch",
    "Khách sạn",
    "Game",
    "Nạp game",
    "Bida",
    "Karaoke",
    "Sự kiện",
  ],
  "Sức khỏe": [
    "Thuốc men",
    "Khám bệnh",
    "Viện phí",
    "Nha khoa",
    "Tiêm vaccine",
    "Gym",
    "Yoga",
    "Cầu lông",
    "Thực phẩm chức năng",
    "BHYT",
  ],
  "Bảo hiểm": [
    "Bảo hiểm xe máy",
    "Bảo hiểm ô tô",
    "Bảo hiểm nhân thọ",
    "Bảo hiểm sức khỏe",
    "Bảo hiểm tai nạn",
  ],
  "Từ thiện & Quà tặng": [
    "Tiền mừng cưới",
    "Hiếu hỉ",
    "Sinh nhật",
    "Quà biếu",
    "Biếu bố mẹ",
    "Quyên góp",
    "Lì xì",
  ],
  "Chi tiêu khác": [
    "Chi tiêu phát sinh",
    "Phí rút tiền",
    "Đổi tiền mặt",
    "Cá nhân",
    "Đồ dùng tiêu hao",
    "Khoản chi linh tinh",
  ],

  // INCOME
  "Lương": [
    "Lương chính",
    "Lương đợt 2",
    "Tạm ứng lương",
    "Lương làm thêm",
    "Lương tháng 13",
    "Phụ cấp cơm",
    "Phụ cấp đi lại",
  ],
  "Thưởng": [
    "Thưởng KPI",
    "Thưởng lễ tết",
    "Hoa hồng",
    "Lì xì",
    "Thưởng dự án",
    "Thưởng nóng",
    "Mừng sinh nhật",
  ],
  "Freelance": [
    "Dự án ngoài",
    "Hợp đồng tư vấn",
    "Thiết kế",
    "Lập trình",
    "Affiliate",
    "Bán hàng online",
    "Dạy học",
    "Nhuận bút",
  ],
  "Hỗ trợ & Trợ cấp": [
    "Bố hỗ trợ sinh hoạt",
    "Mẹ gửi tiền trọ",
    "Mẹ gửi sinh hoạt",
    "Gia đình chu cấp",
    "Người thân cho",
    "Tiền nuôi học",
  ],
  "Lợi tức đầu tư": [
    "Cổ tức tiền mặt",
    "Lãi tiết kiệm",
    "Lãi cho vay",
    "Chốt lời cổ phiếu",
    "Tiền cho thuê nhà",
  ],
  "Thu nhập khác": [
    "Hoàn tiền",
    "Bán đồ cũ",
    "Tiền thừa",
    "Được biếu tiền",
    "Thu nhập phụ",
  ],

  // INVEST
  "Chứng khoán": [
    "Mua cổ phiếu",
    "Bán cổ phiếu",
    "Tài khoản VPS",
    "Cổ tức cổ phiếu",
    "Chứng chỉ quỹ",
    "Phí giao dịch",
  ],
  "Crypto": [
    "Mua USDT",
    "Mua BTC",
    "Bán coin",
    "Phí gas",
    "Staking",
    "Airdrop",
  ],
  "Vàng": [
    "Vàng miếng SJC",
    "Vàng nhẫn 9999",
    "Vàng trang sức",
    "Bán vàng",
    "Tích lũy vàng",
  ],
  "Bất động sản": [
    "Tiền cọc BĐS",
    "Mua đất",
    "Mua căn hộ",
    "Phí công chứng",
    "Thuế trước bạ",
  ],

  // DEBT
  "Nợ phải trả": [
    "Vay TPBank",
    "Trả nợ vay",
    "Trả thẻ tín dụng",
    "Trả góp điện thoại",
    "Trả nợ bạn bè",
    "Tất toán nợ",
    "Giải ngân vay",
  ],
  "Nợ phải thu": [
    "Cho bạn mượn",
    "Thu nợ",
    "Người khác trả nợ",
    "Nhắc nợ",
    "Ứng tiền trước",
  ],

  // SAVINGS
  "Tiết kiệm": [
    "Gửi tiết kiệm",
    "Sổ tiết kiệm",
    "Tiết kiệm online",
    "Tiết kiệm tích lũy",
    "Rút sổ tiết kiệm",
  ],
  "Quỹ dự phòng": [
    "Trích quỹ khẩn cấp",
    "Dự phòng y tế",
    "Sử dụng quỹ dự phòng",
    "Bảo toàn vốn",
  ],
};

// ─────────────────────────────────────────
// Helper trích xuất & tìm kiếm Tag theo danh mục
// ─────────────────────────────────────────

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Danh sách tag gợi ý mặc định phổ biến khi không khớp danh mục cụ thể */
export const DEFAULT_POPULAR_TAGS: string[] = [
  "Cà phê",
  "Ăn sáng",
  "Ăn trưa",
  "Đổ xăng",
  "Đi chợ",
  "Siêu thị",
  "Mua sắm",
  "Tiền điện",
  "Tiền nước",
  "Lương",
  "Khám bệnh",
];

/**
 * Lấy danh sách tag chi tiết cho một danh mục (hỗ trợ khớp gần đúng, không dấu)
 */
export function getCategoryTags(categoryName?: string | null): string[] {
  if (!categoryName) return DEFAULT_POPULAR_TAGS;

  const trimmed = categoryName.trim();
  if (CATEGORY_TAGS[trimmed]) {
    return CATEGORY_TAGS[trimmed];
  }

  const norm = normalizeKey(trimmed);

  // Tìm trong từ điển theo key chuẩn hóa
  for (const [key, tags] of Object.entries(CATEGORY_TAGS)) {
    const keyNorm = normalizeKey(key);
    if (keyNorm === norm || keyNorm.includes(norm) || norm.includes(keyNorm)) {
      return tags;
    }
  }

  // Khớp theo một số bí danh thông dụng
  if (norm.includes("an") || norm.includes("uong") || norm.includes("food") || norm.includes("cafe")) {
    return CATEGORY_TAGS["Ăn uống"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("xang") || norm.includes("di chuyen") || norm.includes("xe") || norm.includes("travel")) {
    return CATEGORY_TAGS["Di chuyển"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("mua") || norm.includes("shopping") || norm.includes("shopee")) {
    return CATEGORY_TAGS["Mua sắm"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("hoa don") || norm.includes("dien") || norm.includes("nuoc") || norm.includes("bill")) {
    return CATEGORY_TAGS["Hóa đơn"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("tro") || norm.includes("nha") || norm.includes("phong")) {
    return CATEGORY_TAGS["Nhà ở & Tiền trọ"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("hoc") || norm.includes("giao duc") || norm.includes("course")) {
    return CATEGORY_TAGS["Giáo dục & Học tập"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("toc") || norm.includes("spa") || norm.includes("lam dep") || norm.includes("barber")) {
    return CATEGORY_TAGS["Làm đẹp & Bản thân"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("bong") || norm.includes("giai tri") || norm.includes("phim")) {
    return CATEGORY_TAGS["Giải trí"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("thuoc") || norm.includes("benh") || norm.includes("suc khoe")) {
    return CATEGORY_TAGS["Sức khỏe"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("luong") || norm.includes("salary")) {
    return CATEGORY_TAGS["Lương"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("thuong") || norm.includes("bonus")) {
    return CATEGORY_TAGS["Thưởng"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("tra no") || norm.includes("vay")) {
    return CATEGORY_TAGS["Nợ phải trả"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("thu no") || norm.includes("cho vay")) {
    return CATEGORY_TAGS["Nợ phải thu"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("tiet kiem") || norm.includes("saving")) {
    return CATEGORY_TAGS["Tiết kiệm"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("chung khoan") || norm.includes("co phieu")) {
    return CATEGORY_TAGS["Chứng khoán"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("crypto") || norm.includes("coin")) {
    return CATEGORY_TAGS["Crypto"] ?? DEFAULT_POPULAR_TAGS;
  }
  if (norm.includes("vang") || norm.includes("gold")) {
    return CATEGORY_TAGS["Vàng"] ?? DEFAULT_POPULAR_TAGS;
  }

  return DEFAULT_POPULAR_TAGS;
}

/**
 * Trích xuất tag chi tiết nếu có trong diễn giải hoặc ghi chú giao dịch.
 * Ví dụ: "[Cà phê] Gặp khách" -> "Cà phê"
 * "Bánh mì ăn sáng" -> "Bánh mì"
 */
export function extractTagFromNote(note?: string | null, categoryName?: string | null): string | null {
  if (!note) return null;
  const trimmed = note.trim();

  // 1. Kiểm tra format tag đóng mở ngoặc vuông [Tag] (trừ các tag hệ thống)
  const bracketMatch = trimmed.match(/\[([^\]]+)\]/);
  if (bracketMatch && bracketMatch[1]) {
    const candidate = bracketMatch[1].trim();
    if (
      !candidate.startsWith("tx_id:") &&
      !candidate.startsWith("SCHEDULE:") &&
      !candidate.startsWith("skip_debt") &&
      !candidate.startsWith("Người:") &&
      !candidate.startsWith("Đối tác:") &&
      candidate !== "Đã vào sổ nợ"
    ) {
      return candidate;
    }
  }

  // 2. Tìm kiếm trong danh sách tag chi tiết của danh mục tương ứng
  const candidateTags = categoryName ? getCategoryTags(categoryName) : [];
  const normNote = " " + normalizeKey(trimmed) + " ";

  for (const tag of candidateTags) {
    const normTag = " " + normalizeKey(tag) + " ";
    if (normNote.includes(normTag)) {
      return tag;
    }
  }

  return null;
}

/**
 * Lấy toàn bộ danh sách tag chi tiết (deduplicated) trong hệ thống
 */
export function getAllTags(): string[] {
  const set = new Set<string>();
  for (const tags of Object.values(CATEGORY_TAGS)) {
    for (const tag of tags) {
      set.add(tag);
    }
  }
  return Array.from(set);
}

// ─────────────────────────────────────────
// Navigation sidebar items
// ─────────────────────────────────────────
export const NAV_ITEMS = [
  { href: "/dashboard",    label: "Tổng quan",   icon: "LayoutDashboard" },
  { href: "/income",       label: "Dòng tiền",   icon: "Banknote"        },
  { href: "/transactions", label: "Giao dịch",   icon: "ArrowLeftRight"  },
  { href: "/import",       label: "Import",      icon: "Sparkles"        },
  { href: "/reports",      label: "Báo cáo",     icon: "BarChart3"       },
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
