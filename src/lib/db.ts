import "temporal-polyfill/global";
import { Pool } from "pg";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../../prisma/contract";
import contractJson from "../../prisma/contract.json" with { type: "json" };

// Prisma 8 — Singleton pattern cho Next.js dev hot-reload.
// Đổi tên khóa global khi thay đổi cách tạo client để hot-reload không dùng lại client cũ.
const globalForDb = global as unknown as { ownwalletDbV2?: ReturnType<typeof createDb> };

/**
 * Pool kết nối tự quản lý để chịu được việc server DB (Prisma Postgres) chủ động cắt
 * các kết nối nhàn rỗi — nguyên nhân lỗi "SqlConnectionError: read ECONNRESET":
 *  - idleTimeoutMillis ngắn: trả kết nối nhàn rỗi trước khi phía server cắt.
 *  - keepAlive: TCP keep-alive giúp phát hiện / giữ kết nối sống.
 *  - pool.on("error"): kết nối nhàn rỗi bị cắt chỉ bị loại khỏi pool, không làm sập tiến trình.
 */
function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  pool.on("error", (err) => {
    console.warn("[db] Kết nối nhàn rỗi bị đóng, sẽ tự tạo kết nối mới:", err.message);
  });
  return pool;
}

function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL chưa được cấu hình trong .env.local");
  }
  return postgres<Contract>({
    contractJson,
    pg: createPool(),
  });
}

function getDb(): ReturnType<typeof createDb> {
  const currentDb = globalForDb.ownwalletDbV2 as any;
  const models = Object.keys((contractJson as any).domain?.namespaces?.public?.models ?? {});
  const isMissingAnyModel =
    !currentDb?.orm?.public || models.some((m) => !currentDb.orm.public[m]);

  // Tự động khởi tạo lại client nếu chưa có hoặc thiếu bất kỳ model nào từ contract.json (ví dụ CashFlowSource sau migration)
  if (!globalForDb.ownwalletDbV2 || isMissingAnyModel) {
    globalForDb.ownwalletDbV2 = createDb();
  }
  return globalForDb.ownwalletDbV2;
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});
