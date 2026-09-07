# OwnWallet — Quản Lí Chi Tiêu Cá Nhân

> Thay thế Excel bằng một web app theo dõi tài chính theo thời gian thực, chính xác đến từng phút.

---

## 1. Tổng Quan Stack

| Mục | Thư viện / Phiên bản | Ghi chú |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Server Components + Server Actions |
| Database | PostgreSQL | Kết nối trực tiếp qua `@prisma/orm-postgres` |
| ORM | **Prisma 8** (Prisma Next) | Contract-first, PSL v2, `contract.prisma` |
| Auth | Auth.js v5 (next-auth@beta) | Credentials + Google OAuth + JWT session |
| Validation | Zod v4 | Dùng chung client + server |
| Forms | react-hook-form + @hookform/resolvers/zod | Kết hợp useActionState |
| Styling | Tailwind CSS v4 | Dark mode mặc định |
| Animation | framer-motion | Micro-animations, transitions |
| Charts | Recharts | Bar, Line, Pie chart |
| Toast | sonner | Thông báo realtime |
| AI | Google Gemini (`@google/generative-ai`) | AI Import: phân tích sao kê ngân hàng |
| Export | xlsx | Xuất file Excel |
| UI Base | @base-ui/react | Headless UI primitives |
| Deploy | Vercel / Standalone Docker | Prisma Composer (`prisma.compute.json`) |
| Password | bcryptjs | Hash mật khẩu |

### Lưu ý quan trọng về stack

- **Prisma 8 (Prisma Next)** — Breaking changes so với Prisma 6/7:
  - Không có `schema.prisma` — dùng **`prisma/contract.prisma`** (PSL v2)
  - Không có `datasource` / `generator` block trong contract — cấu hình qua **`prisma.config.ts`**
  - Client API: `db.orm.public.ModelName.*` thay vì `prisma.modelName.*`
  - Enums yêu cầu `@@type("pg/text@1")` và explicit values
  - ID mặc định: `@default(cuid(2))` thay `@default(cuid())`
  - `updatedAt`: dùng `temporal.updatedAt()` thay `@updatedAt`
  - Singleton client: `src/lib/db.ts` export `db`, `src/lib/prisma.ts` re-export làm alias
- **Auth.js v5** — dùng `AUTH_SECRET`, file `auth.ts` ở `src/lib/`, export `{ handlers, signIn, signOut, auth }`, có thêm **Google OAuth provider**
- **Server Actions** thay API Routes cho mọi mutations — bảo mật + type-safe hơn
- **Next.js 16** — output `standalone` khi không deploy trên Vercel, `prisma.compute.json` dùng cho Prisma Composer

---

## 2. Tính Năng

### 2.1 Giao Dịch (Transaction)
- Nhập nhanh ≤ 3 bước: số tiền → danh mục → lưu
- `recordedAt`: timestamp thực tế do user chọn, chính xác đến phút (≠ `createdAt`)
- Đính kèm ảnh chứng từ (`evidenceUrl`)
- Gắn vào Wallet cụ thể (`walletId`)
- Lọc: ngày / tuần / tháng / năm / khoảng tùy chọn
- Tìm kiếm full-text theo ghi chú, danh mục
- Chỉnh sửa / xóa giao dịch đã nhập

### 2.2 Ví / Tài Khoản (Wallet) ⭐ Mới
- Quản lí nhiều ví: Tiền mặt, Ngân hàng, Ví điện tử...
- Thông tin: tên, số tài khoản, tên ngân hàng, số dư, màu sắc, icon
- Một ví được đặt làm mặc định (`isDefault`)
- Mỗi giao dịch có thể gắn với một ví cụ thể

### 2.3 Ngân Sách (Budget)
- Đặt hạn mức chi tiêu theo danh mục (VD: Ăn uống ≤ 3.000.000đ/tháng)
- Thanh tiến độ realtime: % đã dùng / hạn mức
- Cảnh báo trên UI khi đạt 80% và 100% hạn mức
- Reset tự động đầu mỗi tháng

### 2.4 Danh Mục
```
EXPENSE   — Ăn uống, Di chuyển, Mua sắm, Hóa đơn, Giải trí, Sức khỏe, Khác
INCOME    — Lương, Thưởng, Phụ cấp, Freelance, Khác
INVEST    — Chứng khoán, Crypto, Vàng, Bất động sản
DEBT      — Nợ phải trả, Nợ phải thu
SAVINGS   — Tiết kiệm, Quỹ dự phòng, Kế hoạch tương lai
```
- User tự tạo/sửa/xóa danh mục + chọn màu & icon

### 2.5 Khoản Đầu Tư (Investment)
- Lưu: tài sản, số lượng, giá mua, ngày mua
- Cập nhật giá hiện tại thủ công → tự tính lãi/lỗ
- Lịch sử từng lần BUY / SELL (`InvestLog`)

### 2.6 Quản Lí Nợ (Debt)
- Nợ phải trả (tôi nợ) / Nợ phải thu (người khác nợ tôi)
- Trạng thái: `PENDING` / `PARTIAL` / `PAID`
- Hạn trả → hiển thị cảnh báo nếu quá hạn

### 2.7 Kế Hoạch Tương Lai (Goal)
- Mục tiêu: tên, số tiền cần, deadline
- Thanh tiến độ % đã tích lũy
- Ghi nhận từng lần nạp vào Goal (qua Transaction)

### 2.8 Báo Cáo & Thống Kê
- Biểu đồ thu/chi 7 ngày / 30 ngày (bar chart)
- Phân bổ chi tiêu theo danh mục (pie chart)
- So sánh tháng này vs tháng trước
- Export CSV / Excel danh sách giao dịch

### 2.9 AI Import Sao Kê ⭐ Mới
- Upload file ảnh / PDF sao kê ngân hàng
- Google Gemini phân tích và trích xuất danh sách giao dịch
- User review và xác nhận trước khi import vào DB
- Giới hạn: 10MB/file, tối đa 500 giao dịch/lần

---

## 3. Data Model (Prisma 8 Contract)

> File: `prisma/contract.prisma` — PSL v2, không có `datasource` / `generator` block.
> Cấu hình DB và ORM adapter nằm trong `prisma.config.ts`.

```prisma
// prisma/contract.prisma

enum CategoryType {
  @@type("pg/text@1")
  EXPENSE = "EXPENSE"
  INCOME  = "INCOME"
  INVEST  = "INVEST"
  DEBT    = "DEBT"
  SAVINGS = "SAVINGS"
}

enum TxType {
  @@type("pg/text@1")
  INCOME  = "INCOME"
  EXPENSE = "EXPENSE"
}

enum DebtDir {
  @@type("pg/text@1")
  OWE  = "OWE"   // Tôi nợ người khác
  OWED = "OWED"  // Người khác nợ tôi
}

enum DebtStatus {
  @@type("pg/text@1")
  PENDING = "PENDING"
  PARTIAL = "PARTIAL"
  PAID    = "PAID"
}

enum InvestAction {
  @@type("pg/text@1")
  BUY  = "BUY"
  SELL = "SELL"
}

model User {
  id        String   @id @default(cuid(2))
  email     String   @unique
  name      String?
  password  String                     // bcryptjs hashed
  timezone  String   @default("Asia/Ho_Chi_Minh")
  createdAt DateTime @default(now())
  updatedAt temporal.updatedAt()

  transactions Transaction[]
  investments  Investment[]
  debts        Debt[]
  goals        Goal[]
  categories   Category[]
  budgets      Budget[]
  wallets      Wallet[]

  @@map("User")
}

model Wallet {
  id            String   @id @default(cuid(2))
  name          String
  accountNumber String?
  bankName      String?
  balance       Decimal  @default("0")
  color         String?  @default("#7c3aed")
  icon          String?  @default("Landmark")
  isDefault     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     temporal.updatedAt()

  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@index([userId])
  @@map("Wallet")
}

model Category {
  id        String       @id @default(cuid(2))
  name      String
  type      CategoryType
  color     String
  icon      String?
  isDefault Boolean      @default(false)
  createdAt DateTime     @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  transactions Transaction[]
  budgets      Budget[]

  @@unique([userId, name])
  @@map("Category")
}

model Transaction {
  id          String   @id @default(cuid(2))
  amount      Decimal
  note        String?
  evidenceUrl String?                  // URL ảnh chứng từ
  recordedAt  DateTime                 // Thời điểm thực tế, chính xác đến phút
  createdAt   DateTime @default(now())
  updatedAt   temporal.updatedAt()
  type        TxType

  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])

  goalId String?
  goal   Goal?   @relation(fields: [goalId], references: [id])

  walletId String?
  wallet   Wallet? @relation(fields: [walletId], references: [id])

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, recordedAt])
  @@index([userId, categoryId])
  @@index([userId, type])
  @@index([userId, walletId])
  @@map("Transaction")
}

model Budget {
  id          String  @id @default(cuid(2))
  limitAmount Decimal
  month       Int
  year        Int

  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, categoryId, month, year])
  @@map("Budget")
}

model Investment {
  id           String   @id @default(cuid(2))
  name         String
  ticker       String?
  quantity     Decimal
  buyPrice     Decimal
  currentPrice Decimal?
  boughtAt     DateTime
  createdAt    DateTime @default(now())
  updatedAt    temporal.updatedAt()

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs   InvestLog[]

  @@map("Investment")
}

model InvestLog {
  id         String       @id @default(cuid(2))
  action     InvestAction
  quantity   Decimal
  price      Decimal
  recordedAt DateTime
  createdAt  DateTime     @default(now())

  investmentId String
  investment   Investment @relation(fields: [investmentId], references: [id], onDelete: Cascade)

  @@map("InvestLog")
}

model Debt {
  id         String     @id @default(cuid(2))
  person     String
  amount     Decimal
  paidAmount Decimal    @default("0")
  direction  DebtDir
  status     DebtStatus @default(PENDING)
  dueDate    DateTime?
  note       String?
  createdAt  DateTime   @default(now())
  updatedAt  temporal.updatedAt()

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([userId, direction])
  @@map("Debt")
}

model Goal {
  id           String    @id @default(cuid(2))
  name         String
  targetAmount Decimal
  savedAmount  Decimal   @default("0")
  deadline     DateTime?
  note         String?
  createdAt    DateTime  @default(now())
  updatedAt    temporal.updatedAt()

  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  contributions Transaction[]

  @@map("Goal")
}
```

---

## 4. Cấu Trúc Project

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              # Sidebar + Header
│   │   ├── loading.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── transactions/
│   │   │   ├── page.tsx            # Danh sách + bộ lọc
│   │   │   └── new/page.tsx        # Form nhập nhanh (nếu có)
│   │   ├── wallets/page.tsx        # Quản lí ví / tài khoản ⭐
│   │   ├── budget/page.tsx
│   │   ├── investments/page.tsx
│   │   ├── debts/page.tsx
│   │   ├── goals/page.tsx
│   │   ├── savings/page.tsx
│   │   ├── assets/page.tsx
│   │   ├── import/page.tsx         # AI Import sao kê ⭐
│   │   ├── reports/page.tsx        # Biểu đồ + thống kê
│   │   └── settings/page.tsx       # Danh mục, tài khoản
│   └── api/auth/[...nextauth]/route.ts
├── lib/
│   ├── db.ts                       # Prisma 8 client singleton (export `db`)
│   ├── prisma.ts                   # Re-export `db` as `prisma` (alias compat)
│   ├── auth.ts                     # Auth.js v5 config (Credentials + Google)
│   ├── constants.ts                # DEFAULT_CATEGORIES, hằng số ứng dụng
│   ├── utils.ts                    # Helper functions
│   ├── system-settings.ts          # System settings
│   └── ai/                         # AI utilities
├── actions/                        # Server Actions
│   ├── auth.ts
│   ├── transactions.ts
│   ├── wallets.ts                  # ⭐ Mới
│   ├── budgets.ts
│   ├── investments.ts
│   ├── debts.ts
│   ├── goals.ts
│   ├── reports.ts
│   ├── settings.ts
│   └── ai-import.ts                # ⭐ AI Import
├── schemas/                        # Zod v4 schemas
│   ├── auth.ts
│   ├── transaction.ts
│   ├── budget.ts
│   ├── debt.ts
│   ├── goal.ts
│   ├── investment.ts
│   ├── settings.ts
│   └── ai-import.ts
└── components/
    ├── ui/                         # Button, Input, Modal, Badge, Toast...
    └── layout/                     # Sidebar, Header, Navigation
prisma/
├── contract.prisma                 # PSL v2 Contract (Prisma 8)
├── contract.d.ts                   # Auto-generated types
├── contract.json                   # Auto-generated JSON contract
└── seed.ts                         # Seed dữ liệu mặc định
scripts/
├── shim-prisma.mjs                 # Postinstall shim cho Prisma 8
└── copy-standalone.mjs             # Copy standalone build artifacts
```

---

## 5. Prisma 8 — Config & Client

```typescript
// prisma.config.ts — cấu hình Prisma 8
import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/contract.prisma",
    db: {
      connection: process.env.DATABASE_URL!,
    },
  }),
});
```

```typescript
// src/lib/db.ts — Singleton Prisma 8 client
import "temporal-polyfill/global";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../../prisma/contract";
import contractJson from "../../prisma/contract.json" with { type: "json" };

const globalForDb = global as unknown as { db?: ReturnType<typeof createDb> };

function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL chưa được cấu hình trong .env.local");
  }
  return postgres<Contract>({
    contractJson,
    url: process.env.DATABASE_URL,
  });
}

function getDb() {
  if (!globalForDb.db) globalForDb.db = createDb();
  return globalForDb.db;
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});
```

```typescript
// src/lib/prisma.ts — alias cho backward compat
export { db as prisma } from "./db";
```

**Cách query với Prisma 8:**
```typescript
// Thay vì: prisma.user.findUnique(...)
// Dùng:
const user = await db.orm.public.User
  .select("id", "email", "name")
  .where({ email })
  .first();

// Create:
await db.orm.public.Category.create({ ...data, userId });

// Transaction:
await db.transaction(async (tx) => {
  await tx.orm.public.User.create({ ... });
  await tx.orm.public.Category.create({ ... });
});
```

---

## 6. Auth.js v5 — Config Chuẩn

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await db.orm.public.User
          .select("id", "email", "name", "password")
          .where({ email: credentials.email as string })
          .first();
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: { /* jwt + session callbacks để inject user.id */ }
});
```

---

## 7. UI / UX

### Dashboard Layout
```
┌─────────────────────────────────────────────────────────┐
│  Thu nhập    Tiêu dùng    Số dư ròng    Đầu tư (lãi/lỗ) │  ← 4 thẻ KPI
├─────────────────────────────────────────────────────────┤
│  Bar chart thu/chi 30 ngày   │  Pie chart danh mục chi  │
├─────────────────────────────────────────────────────────┤
│  10 giao dịch gần nhất       │  Budget (progress bars)  │
│                              │  Goals (progress bars)   │
│                              │  Nợ sắp đến hạn          │
└─────────────────────────────────────────────────────────┘
```

### Màu sắc & Design System
```
Thu nhập  → #22c55e (xanh lá)
Chi tiêu  → #ef4444 (đỏ)
Đầu tư    → #3b82f6 (xanh dương)
Nợ        → #f59e0b (vàng)
Tiết kiệm → #8b5cf6 (tím)
Background → #0f172a (dark) / #f8fafc (light)
Wallet    → #7c3aed (tím đậm, mặc định)
```

### Nguyên Tắc UX
- Nhập giao dịch ≤ 3 bước, không cần rời trang
- Timestamp mặc định = now, user có thể sửa
- Số tiền format tự động: `3000000` → `3.000.000 ₫`
- Cảnh báo budget hiện inline (không popup)
- Mobile-first, sidebar collapse trên mobile
- Glassmorphism sidebar với backdrop-blur
- Privacy mask cho số tài khoản nhạy cảm

---

## 8. Logic Nghiệp Vụ

| Quy tắc | Công thức / Mô tả |
|---|---|
| Số dư ròng | `Σ INCOME - Σ EXPENSE` trong kỳ |
| Budget đã dùng | Σ EXPENSE của category trong tháng/năm hiện tại |
| Budget cảnh báo | `usedAmount / limitAmount ≥ 0.8` → warning UI |
| Lãi/lỗ đầu tư | `(currentPrice - buyPrice) × quantity` |
| Nợ còn lại | `amount - paidAmount` |
| Goal % | `savedAmount / targetAmount × 100` |
| `recordedAt` | Lưu UTC, hiển thị theo `user.timezone` |
| Debt quá hạn | `dueDate < now && status !== PAID` |
| Wallet balance | Cập nhật thủ công hoặc tính từ transactions |

---

## 9. Validation Schema (Zod v4)

```typescript
// src/schemas/transaction.ts
import { z } from "zod";

export const TransactionSchema = z.object({
  amount: z.coerce.number({ error: "Số tiền không hợp lệ" }).positive("Số tiền phải lớn hơn 0"),
  type: z.enum(["INCOME", "EXPENSE"] as const, { error: "Chọn loại giao dịch" }),
  categoryId: z.string().min(1, "Chọn danh mục"),
  note: z.string().max(200).optional().nullable(),
  recordedAt: z.coerce.date({ error: "Chọn thời điểm giao dịch" }),
  goalId: z.string().optional().nullable(),
  walletId: z.string().optional().nullable(),
  evidenceUrl: z.string().optional().nullable(),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;
```

> **Lưu ý Zod v4**: Dùng `{ error: "..." }` thay vì `{ message: "..." }` cho custom error messages.

---

## 10. Môi Trường & Deploy

### Biến môi trường (.env.local)
```env
# ─── DATABASE ────────────────────────────────────────────
# PostgreSQL connection string
DATABASE_URL="postgres://user:password@localhost:5432/ownwallet"

# ─── AUTH.JS v5 ──────────────────────────────────────────
AUTH_SECRET="..."                        # openssl rand -base64 32
NEXTAUTH_SECRET="..."                    # alias (fallback)
NEXTAUTH_URL="http://localhost:3000"

# ─── GOOGLE OAUTH ────────────────────────────────────────
# Lấy tại Google Cloud Console → APIs & Services → Credentials
# Authorized redirect URI: http://localhost:3000/api/auth/callback/google
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# ─── WHITELIST ───────────────────────────────────────────
# Danh sách email được phép truy cập (phân cách bằng dấu phẩy)
# Để trống = cho phép tất cả
ALLOWED_EMAILS=""

# ─── GOOGLE GEMINI AI ────────────────────────────────────
# Lấy tại: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-3.6-flash"
AI_MAX_FILE_SIZE_BYTES=10485760          # 10MB
AI_MAX_TRANSACTIONS_PER_PARSE=500

# ─── TIMEZONE ────────────────────────────────────────────
TZ="Asia/Ho_Chi_Minh"
```

### package.json scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma contract emit && next build && node scripts/copy-standalone.mjs",
    "start": "next start",
    "lint": "eslint",
    "postinstall": "node scripts/shim-prisma.mjs && prisma contract emit",
    "db:emit": "prisma contract emit",
    "db:migrate": "prisma migration plan && prisma db migrate",
    "db:apply": "prisma db migrate",
    "db:deploy": "prisma db migrate",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

### Deploy Vercel (từng bước)
```bash
# 1. Push code lên GitHub
# 2. Vào vercel.com → New Project → Import repo
# 3. Chuẩn bị PostgreSQL (Vercel Postgres, Supabase, Neon...)
#    → copy DATABASE_URL
# 4. Thêm tất cả env vars vào Vercel Project Settings
# 5. Build command: prisma contract emit && next build
# 6. Migrate production DB:
npx prisma db migrate
```

### Deploy Standalone (Docker / VPS)
```bash
# Build
npm run build
# output: .next/standalone + scripts/copy-standalone.mjs tự copy public/

# Run
node .next/standalone/server.js
```

---

## 11. Thứ Tự Phát Triển (Roadmap)

```
Phase 1 — Foundation ✅
  [x] Init Next.js 16 + Prisma 8 + Auth.js v5
  [x] Contract schema + migrate
  [x] Auth: đăng nhập / đăng ký (bcryptjs) + Google OAuth
  [x] Singleton db.ts + lib/auth.ts

Phase 2 — Core Features ✅
  [x] CRUD Category (với seed data mặc định)
  [x] CRUD Transaction + Zod v4 validation
  [x] Dashboard: 4 KPI cards + 10 giao dịch gần nhất
  [x] Bộ lọc ngày/tháng/năm

Phase 3 — Finance Modules ✅
  [x] Budget: đặt hạn mức + progress bar + cảnh báo 80%
  [x] Investment: thêm/sửa + tính lãi lỗ + InvestLog
  [x] Debt: OWE / OWED + trạng thái + cảnh báo quá hạn
  [x] Goal: đặt mục tiêu + nạp tiền + progress
  [x] Wallet: quản lí nhiều ví / tài khoản

Phase 4 — Reports & Polish ✅
  [x] Recharts: bar chart 30 ngày, pie chart danh mục
  [x] So sánh tháng này vs tháng trước
  [x] Export Excel (xlsx)
  [x] Dark mode glassmorphism UI
  [x] Responsive mobile (sidebar collapse)
  [x] Ảnh chứng từ giao dịch (evidenceUrl)

Phase 5 — AI Features ✅
  [x] AI Import: upload sao kê ngân hàng → Gemini phân tích → import
  [ ] AI gợi ý ngân sách tự động (v2)
  [ ] Phân tích xu hướng chi tiêu bằng AI (v2)
```

---

## 12. Quyết Định Kỹ Thuật

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| ORM | ✅ Prisma 8 (contract-first) | Type-safe, PSL v2, migration tích hợp |
| DB Pool | ✅ `@prisma/orm-postgres` built-in | Không cần PgBouncer thủ công |
| Session | ✅ JWT (Auth.js v5) | Phù hợp Serverless, không cần DB session |
| Auth Provider | ✅ Credentials + Google OAuth | Hỗ trợ cả đăng nhập tự quản lí lẫn OAuth |
| API | ✅ Server Actions | Bảo mật + DX tốt hơn API Routes |
| AI | ✅ Google Gemini | Phân tích sao kê đa ngôn ngữ |
| Export | ✅ xlsx | Excel phổ biến hơn CSV với người dùng VN |
| Multi-currency | ❌ Chỉ VNĐ (v1) | Đơn giản hóa |
| Real-time price | ❌ Nhập tay | Tránh phụ thuộc API ngoài |
| Push notification | ❌ Chỉ cảnh báo UI | Không cần service worker |
| Recurring tx | ❌ v2 | Out of scope |
