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

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
