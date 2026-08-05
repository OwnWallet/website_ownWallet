import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton pattern — bắt buộc với Next.js để tránh connection leak trong dev hot-reload
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // Prisma 7 yêu cầu driver adapter thay vì đọc URL từ schema
  // Hỗ trợ cả Prisma Postgres (prisma+postgres://) và PostgreSQL thường (postgresql://)
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL chưa được cấu hình trong .env.local");
  }

  // Với Prisma Postgres / Accelerate: dùng accelerateUrl
  if (connectionString.startsWith("prisma+postgres://")) {
    return new PrismaClient({
      accelerateUrl: connectionString,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  // Với PostgreSQL thường: dùng adapter-pg
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
