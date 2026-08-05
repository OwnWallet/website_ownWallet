# wnWallet — Quản Lí Chi Tiêu Cá Nhân

> Thay thế Excel bằng một web app theo dõi tài chính theo thời gian thực, chính xác đến từng phút.

---

## 1. Tổng Quan Stack

| Mục | Thư viện / Phiên bản | Ghi chú |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Server Components + Server Actions |
| Database | PostgreSQL | Managed bởi Prisma Postgres |
| ORM | Prisma 6.x | Built-in connection pooling (Prisma Postgres) |
| Auth | Auth.js v5 (next-auth@beta) | Credentials provider + JWT session |
| Validation | Zod | Dùng chung client + server |
| Forms | react-hook-form + @hookform/resolvers/zod | Kết hợp useActionState |
| Styling | Tailwind CSS v4 | Dark mode mặc định |
| Charts | Recharts | Bar, Line, Pie chart |
| Deploy | Vercel + Prisma Postgres | Serverless-ready |
| Password | bcryptjs | Hash mật khẩu |

### Lưu ý quan trọng về stack

- **Auth.js v5** thay NextAuth.js v4 — API thay đổi: dùng `AUTH_SECRET` thay `NEXTAUTH_SECRET`, file `auth.ts` ở root, export `{ handlers, signIn, signOut, auth }`
- **Prisma Postgres** (prisma.io/postgres) thay Vercel Postgres — tích hợp connection pooling sẵn, không cần PgBouncer thủ công
- **Server Actions** thay API Routes cho mutations — bảo mật hơn, type-safe hơn
- **Singleton Prisma Client** bắt buộc (`lib/prisma.ts`) để tránh connection leak trong dev hot-reload

---

## 2. Tính Năng

### 2.1 Giao Dịch (Transaction)
- Nhập nhanh ≤ 3 bước: số tiền → danh mục → lưu
- `recordedAt`: timestamp thực tế do user chọn, chính xác đến phút (≠ `createdAt`)
- Lọc: ngày / tuần / tháng / năm / khoảng tùy chọn
- Tìm kiếm full-text theo ghi chú, danh mục
- Chỉnh sửa / xóa giao dịch đã nhập

### 2.2 Ngân Sách (Budget)
- Đặt hạn mức chi tiêu theo danh mục (VD: Ăn uống ≤ 3.000.000đ/tháng)
- Thanh tiến độ realtime: % đã dùng / hạn mức
- Cảnh báo trên UI khi đạt 80% và 100% hạn mức
- Reset tự động đầu mỗi tháng

### 2.3 Danh Mục
```
EXPENSE   — Ăn uống, Di chuyển, Mua sắm, Hóa đơn, Giải trí, Sức khỏe, Khác
INCOME    — Lương, Thưởng, Phụ cấp, Freelance, Khác
INVEST    — Chứng khoán, Crypto, Vàng, Bất động sản
DEBT      — Nợ phải trả, Nợ phải thu
SAVINGS   — Tiết kiệm, Quỹ dự phòng, Kế hoạch tương lai
```
- User tự tạo/sửa/xóa danh mục + chọn màu & icon

### 2.4 Khoản Đầu Tư (Investment)
- Lưu: tài sản, số lượng, giá mua, ngày mua
- Cập nhật giá hiện tại thủ công → tự tính lãi/lỗ
- Lịch sử từng lần BUY / SELL

### 2.5 Quản Lí Nợ (Debt)
- Nợ phải trả (tôi nợ) / Nợ phải thu (người khác nợ tôi)
- Trạng thái: `PENDING` / `PARTIAL` / `PAID`
- Hạn trả → hiển thị cảnh báo nếu quá hạn

### 2.6 Kế Hoạch Tương Lai (Goal)
- Mục tiêu: tên, số tiền cần, deadline
- Thanh tiến độ % đã tích lũy
- Ghi nhận từng lần nạp vào Goal

### 2.7 Báo Cáo & Thống Kê
- Biểu đồ thu/chi 7 ngày / 30 ngày (bar chart)
- Phân bổ chi tiêu theo danh mục (pie chart)
- So sánh tháng này vs tháng trước
- Export CSV danh sách giao dịch

---

## 3. Data Model (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String?
  password     String        // bcryptjs hashed
  timezone     String        @default("Asia/Ho_Chi_Minh")
  createdAt    DateTime      @default(now())
  transactions Transaction[]
  investments  Investment[]
  debts        Debt[]
  goals        Goal[]
  categories   Category[]
  budgets      Budget[]
}

model Category {
  id           String        @id @default(cuid())
  name         String
  type         CategoryType
  color        String        // hex color, VD: "#22c55e"
  icon         String?       // emoji hoặc icon name
  isDefault    Boolean       @default(false)
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]
  budgets      Budget[]
}

model Transaction {
  id          String    @id @default(cuid())
  amount      Decimal   @db.Decimal(15, 2)
  note        String?
  recordedAt  DateTime  // thời điểm thực tế, chính xác đến phút
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  type        TxType
  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])
  goalId      String?   // nếu là nạp tiền vào Goal
  goal        Goal?     @relation(fields: [goalId], references: [id])
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, recordedAt])
  @@index([userId, categoryId])
}

model Budget {
  id         String   @id @default(cuid())
  limitAmount Decimal @db.Decimal(15, 2)
  month      Int      // 1-12
  year       Int
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, categoryId, month, year])
}

model Investment {
  id           String      @id @default(cuid())
  name         String      // "VN30F", "BTC", "Vàng SJC"
  ticker       String?
  quantity     Decimal     @db.Decimal(18, 8)
  buyPrice     Decimal     @db.Decimal(15, 2)
  currentPrice Decimal?    @db.Decimal(15, 2)
  boughtAt     DateTime
  updatedAt    DateTime    @updatedAt
  userId       String
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs         InvestLog[]
}

model InvestLog {
  id           String     @id @default(cuid())
  investmentId String
  investment   Investment @relation(fields: [investmentId], references: [id], onDelete: Cascade)
  action       InvestAction
  quantity     Decimal    @db.Decimal(18, 8)
  price        Decimal    @db.Decimal(15, 2)
  recordedAt   DateTime
}

model Debt {
  id         String     @id @default(cuid())
  person     String
  amount     Decimal    @db.Decimal(15, 2)
  paidAmount Decimal    @db.Decimal(15, 2) @default(0)
  direction  DebtDir
  status     DebtStatus @default(PENDING)
  dueDate    DateTime?
  note       String?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Goal {
  id           String        @id @default(cuid())
  name         String
  targetAmount Decimal       @db.Decimal(15, 2)
  savedAmount  Decimal       @db.Decimal(15, 2) @default(0)
  deadline     DateTime?
  note         String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  contributions Transaction[]
}

enum CategoryType { EXPENSE INCOME INVEST DEBT SAVINGS }
enum TxType       { INCOME EXPENSE }
enum DebtDir      { OWE OWED }
enum DebtStatus   { PENDING PARTIAL PAID }
enum InvestAction { BUY SELL }
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
│   │   ├── layout.tsx          # Sidebar + Header
│   │   ├── dashboard/page.tsx
│   │   ├── transactions/
│   │   │   ├── page.tsx        # Danh sách + bộ lọc
│   │   │   └── new/page.tsx    # Form nhập nhanh
│   │   ├── budget/page.tsx
│   │   ├── investments/page.tsx
│   │   ├── debts/page.tsx
│   │   ├── goals/page.tsx
│   │   ├── reports/page.tsx    # Biểu đồ + thống kê
│   │   └── settings/page.tsx   # Danh mục, tài khoản
│   └── api/auth/[...nextauth]/route.ts
├── lib/
│   ├── prisma.ts               # Singleton PrismaClient
│   ├── auth.ts                 # Auth.js v5 config
│   └── schemas/                # Zod schemas
├── actions/                    # Server Actions
│   ├── transactions.ts
│   ├── budgets.ts
│   ├── investments.ts
│   ├── debts.ts
│   └── goals.ts
└── components/
    ├── ui/                     # Button, Input, Modal, Badge...
    ├── charts/                 # BarChart, PieChart, LineChart
    └── forms/                  # TransactionForm, GoalForm...
```

---

## 5. Auth.js v5 — Config Chuẩn

```typescript
// lib/auth.ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
})
```

```typescript
// lib/prisma.ts — Singleton pattern bắt buộc
import { PrismaClient } from "@prisma/client"
const globalForPrisma = global as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

---

## 6. UI / UX

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
```

### Nguyên Tắc UX
- Nhập giao dịch ≤ 3 bước, không cần rời trang
- Timestamp mặc định = now, user có thể sửa
- Số tiền format tự động: `3000000` → `3.000.000 ₫`
- Cảnh báo budget hiện inline (không popup)
- Mobile-first, sidebar collapse trên mobile

---

## 7. Logic Nghiệp Vụ

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

---

## 8. Validation Schema (Zod)

```typescript
// lib/schemas/transaction.ts
export const TransactionSchema = z.object({
  amount: z.coerce.number().positive("Số tiền phải > 0"),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().cuid(),
  note: z.string().max(200).optional(),
  recordedAt: z.coerce.date(),
  goalId: z.string().cuid().optional(),
})
```

---

## 9. Môi Trường & Deploy

### Biến môi trường (.env)
```env
# Prisma Postgres (pooled — dùng cho app)
DATABASE_URL="prisma+postgres://..."

# Auth.js v5
AUTH_SECRET="..."                        # npx auth secret

# Timezone mặc định
TZ="Asia/Ho_Chi_Minh"
```

### Deploy Vercel (từng bước)
```bash
# 1. Push code lên GitHub
# 2. Vào vercel.com → New Project → Import repo
# 3. Prisma Postgres: prisma.io/postgres → tạo DB → copy DATABASE_URL
# 4. Thêm env vars vào Vercel Project Settings
# 5. Build command: prisma generate && next build
# 6. Migrate production:
npx prisma migrate deploy
```

### package.json scripts cần có
```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

---

## 10. Thứ Tự Phát Triển

```
Phase 1 — Foundation
  [ ] Init Next.js 15 + Prisma + Auth.js v5
  [ ] Schema DB + migrate
  [ ] Auth: đăng nhập / đăng ký (bcryptjs)
  [ ] Singleton prisma.ts + lib/auth.ts

Phase 2 — Core Features
  [ ] CRUD Category (với seed data mặc định)
  [ ] CRUD Transaction + Zod validation
  [ ] Dashboard: 4 KPI cards + 10 giao dịch gần nhất
  [ ] Bộ lọc ngày/tháng/năm

Phase 3 — Finance Modules
  [ ] Budget: đặt hạn mức + progress bar + cảnh báo 80%
  [ ] Investment: thêm/sửa + tính lãi lỗ
  [ ] Debt: OWE / OWED + trạng thái + cảnh báo quá hạn
  [ ] Goal: đặt mục tiêu + nạp tiền + progress

Phase 4 — Reports & Polish
  [ ] Recharts: bar chart 30 ngày, pie chart danh mục
  [ ] So sánh tháng này vs tháng trước
  [ ] Export CSV
  [ ] Dark/Light mode toggle
  [ ] Responsive mobile (sidebar collapse)
```

---

## 11. Quyết Định Kỹ Thuật

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Multi-currency | ❌ Chỉ VNĐ (v1) | Đơn giản hóa |
| Real-time price | ❌ Nhập tay | Tránh phụ thuộc API ngoài |
| Push notification | ❌ Chỉ cảnh báo UI | Không cần service worker |
| Recurring tx | ❌ v2 | Out of scope |
| API Routes | ❌ Dùng Server Actions | Bảo mật + DX tốt hơn |
| ORM | ✅ Prisma | Type-safe, migration dễ |
| DB Pool | ✅ Prisma Postgres built-in | Không cần config thêm |
| Session | ✅ JWT (Auth.js v5 Credentials) | Phù hợp single user |
