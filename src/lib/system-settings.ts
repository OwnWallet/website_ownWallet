import { Pool } from "pg";

let _pool: Pool | null = null;

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) {
    const isLocal =
      process.env.DATABASE_URL.includes("localhost") ||
      process.env.DATABASE_URL.includes("127.0.0.1");

    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

let _tableEnsured = false;
async function ensureTable(pool: Pool): Promise<void> {
  if (_tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "SystemSetting" (
        "key" VARCHAR(255) PRIMARY KEY,
        "value" TEXT NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    _tableEnsured = true;
  } catch (err) {
    console.error("[SystemSetting] Failed to ensure table:", err);
  }
}

/**
 * Lấy cấu hình hệ thống (ưu tiên biến môi trường process.env, sau đó đến cơ sở dữ liệu)
 */
export async function getSystemSetting(key: string, defaultValue = ""): Promise<string> {
  // Nếu đã có sẵn trong process.env và không rỗng
  if (process.env[key] && process.env[key]!.trim().length > 0) {
    return process.env[key]!;
  }

  const pool = getPool();
  if (!pool) return defaultValue;

  try {
    await ensureTable(pool);
    const res = await pool.query<{ value: string }>(
      'SELECT "value" FROM "SystemSetting" WHERE "key" = $1 LIMIT 1',
      [key]
    );
    if (res.rows.length > 0 && res.rows[0].value) {
      const val = res.rows[0].value;
      process.env[key] = val;
      return val;
    }
  } catch (err) {
    console.error(`[SystemSetting] Lỗi khi đọc cấu hình "${key}":`, err);
  }

  return defaultValue;
}

/**
 * Lưu cấu hình hệ thống vào cơ sở dữ liệu và đồng bộ vào process.env
 */
export async function setSystemSetting(key: string, value: string): Promise<void> {
  // Luôn cập nhật runtime process.env
  process.env[key] = value;

  const pool = getPool();
  if (!pool) return;

  try {
    await ensureTable(pool);
    await pool.query(
      `INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
      [key, value]
    );
  } catch (err) {
    console.error(`[SystemSetting] Lỗi khi lưu cấu hình "${key}" vào DB:`, err);
    throw new Error(`Không thể lưu cấu hình vào cơ sở dữ liệu: ${(err as any)?.message || err}`);
  }
}
