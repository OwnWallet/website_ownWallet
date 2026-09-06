import "temporal-polyfill/global";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../../prisma/contract";
import contractJson from "../../prisma/contract.json" with { type: "json" };

// Prisma 8 — Singleton pattern cho Next.js dev hot-reload
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

function getDb(): ReturnType<typeof createDb> {
  // Tự động khởi tạo lại client nếu chưa có hoặc thiếu model mới như Wallet trong singleton cache dev
  if (!globalForDb.db || !(globalForDb.db as any).orm?.public?.Wallet) {
    globalForDb.db = createDb();
  }
  return globalForDb.db;
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});
