import { randomUUID } from "crypto";
import { getPool } from "@/lib/system-settings";
import type { CategoryRule } from "@/lib/category-rules";

/**
 * Lưu trữ quy tắc phân loại tự học.
 * Dùng bảng riêng tự khởi tạo (giống SystemSetting) để không cần migration Prisma contract.
 */

let _tableEnsured = false;

async function ensureTable(): Promise<ReturnType<typeof getPool>> {
  const pool = getPool();
  if (!pool || _tableEnsured) return pool;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "CategoryRule" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "keyword" TEXT NOT NULL,
      "txType" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL,
      "hits" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CategoryRule_userId_keyword_txType_key" UNIQUE ("userId", "keyword", "txType")
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "CategoryRule_userId_idx" ON "CategoryRule" ("userId");`);
  _tableEnsured = true;
  return pool;
}

export async function getCategoryRules(userId: string): Promise<CategoryRule[]> {
  try {
    const pool = await ensureTable();
    if (!pool) return [];
    const res = await pool.query<CategoryRule>(
      `SELECT "id", "keyword", "txType", "categoryId", "hits"
         FROM "CategoryRule" WHERE "userId" = $1
        ORDER BY "hits" DESC, "updatedAt" DESC`,
      [userId]
    );
    return res.rows;
  } catch (err) {
    // Không để lỗi quy tắc làm hỏng luồng import
    console.error("[CategoryRule] Không thể đọc quy tắc:", (err as Error)?.message);
    return [];
  }
}

/**
 * Ghi nhận quy tắc từ các lần sửa danh mục. Nếu đã có quy tắc cùng (từ khóa, loại):
 * - cùng danh mục → tăng hits
 * - khác danh mục → đổi sang danh mục mới, đặt lại hits = 1 (lựa chọn mới nhất của người dùng thắng)
 */
export async function upsertCategoryRules(
  userId: string,
  entries: { keyword: string; txType: "INCOME" | "EXPENSE"; categoryId: string }[]
): Promise<number> {
  if (entries.length === 0) return 0;
  const pool = await ensureTable();
  if (!pool) return 0;
  let count = 0;
  for (const e of entries) {
    await pool.query(
      `INSERT INTO "CategoryRule" ("id", "userId", "keyword", "txType", "categoryId")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("userId", "keyword", "txType") DO UPDATE SET
         "hits" = CASE WHEN "CategoryRule"."categoryId" = EXCLUDED."categoryId"
                       THEN "CategoryRule"."hits" + 1 ELSE 1 END,
         "categoryId" = EXCLUDED."categoryId",
         "updatedAt" = CURRENT_TIMESTAMP`,
      [randomUUID(), userId, e.keyword, e.txType, e.categoryId]
    );
    count++;
  }
  return count;
}

/** Tăng độ tin cậy cho các quy tắc được áp dụng và người dùng giữ nguyên */
export async function reinforceCategoryRules(
  userId: string,
  keys: { keyword: string; txType: "INCOME" | "EXPENSE" }[]
): Promise<void> {
  if (keys.length === 0) return;
  const pool = await ensureTable();
  if (!pool) return;
  for (const k of keys) {
    await pool.query(
      `UPDATE "CategoryRule" SET "hits" = "hits" + 1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = $1 AND "keyword" = $2 AND "txType" = $3`,
      [userId, k.keyword, k.txType]
    );
  }
}

export async function deleteCategoryRule(userId: string, id: string): Promise<boolean> {
  const pool = await ensureTable();
  if (!pool) return false;
  const res = await pool.query(`DELETE FROM "CategoryRule" WHERE "id" = $1 AND "userId" = $2`, [id, userId]);
  return (res.rowCount ?? 0) > 0;
}
