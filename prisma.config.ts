import { defineConfig } from "prisma/config";

// Prisma 7+ — URL được cấu hình tại đây thay vì trong schema.prisma
// Đọc từ .env.local hoặc biến môi trường (Vercel tự inject)
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma Postgres: "prisma+postgres://accelerate.prisma-data.net/?api_key=..."
    // Local PostgreSQL: "postgresql://user:pass@localhost:5432/wnwallet"
    url: process.env.DATABASE_URL!,
  },
});
