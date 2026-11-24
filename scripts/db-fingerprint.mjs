#!/usr/bin/env node
/**
 * Dấu vân tay dữ liệu DB: số dòng + checksum md5 nội dung từng bảng.
 * Dùng để chứng minh dữ liệu không đổi trước / sau khi thay đổi schema hoặc khôi phục backup.
 *
 *   node scripts/db-fingerprint.mjs [--url <postgres-url>] [--out file.json] [--compare before.json]
 *
 * --compare: tính lại theo đúng danh sách cột của file trước (cột mới thêm không làm lệch),
 *            in bảng khác biệt và exit 1 nếu có bảng cũ nào không khớp.
 * Mặc định dùng DATABASE_URL trong .env. Không bao giờ in URL ra màn hình.
 */
import "dotenv/config";
import fs from "node:fs";
import pg from "pg";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const url = arg("--url") || process.env.DATABASE_URL;
const outFile = arg("--out");
const compareFile = arg("--compare");
if (!url) {
  console.error("Thiếu DATABASE_URL (hoặc --url)");
  process.exit(2);
}

const qi = (s) => '"' + String(s).replace(/"/g, '""') + '"';

async function main() {
  const baseline = compareFile ? JSON.parse(fs.readFileSync(compareFile, "utf8")) : null;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    // Định dạng text của timestamp phụ thuộc múi giờ phiên → cố định để so sánh được.
    await client.query("SET TIME ZONE 'UTC'");
    await client.query("SET DateStyle = 'ISO, MDY'");
    await client.query("SET extra_float_digits = 3");

    const { rows: cols } = await client.query(
      `SELECT c.table_name, c.column_name
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name, c.ordinal_position`
    );
    const liveTables = new Map();
    for (const c of cols) {
      if (!liveTables.has(c.table_name)) liveTables.set(c.table_name, []);
      liveTables.get(c.table_name).push(c.column_name);
    }

    const result = { takenAt: new Date().toISOString(), tables: {} };
    const tableNames = baseline ? Object.keys(baseline.tables) : [...liveTables.keys()].sort();

    for (const table of tableNames) {
      const live = liveTables.get(table);
      if (!live) {
        result.tables[table] = { missing: true };
        continue;
      }
      const columns = baseline ? baseline.tables[table].columns : live;
      const missingCols = columns.filter((c) => !live.includes(c));
      if (missingCols.length) {
        result.tables[table] = { columns, missingColumns: missingCols };
        continue;
      }
      // Sắp xếp theo toàn bộ nội dung dòng → ổn định kể cả bảng không có cột id.
      const rowExpr = `ROW(${columns.map(qi).join(", ")})::text`;
      const { rows } = await client.query(
        `SELECT count(*)::int AS n, md5(coalesce(string_agg(r, E'\\n' ORDER BY r), '')) AS h
           FROM (SELECT ${rowExpr} AS r FROM public.${qi(table)}) s`
      );
      result.tables[table] = { columns, rows: rows[0].n, md5: rows[0].h };
    }

    if (outFile) fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

    if (baseline) {
      let bad = 0;
      for (const table of tableNames) {
        const a = baseline.tables[table];
        const b = result.tables[table];
        const ok = !b.missing && !b.missingColumns && a.rows === b.rows && a.md5 === b.md5;
        if (!ok) bad++;
        console.log(`${ok ? "OK  " : "DIFF"} ${table.padEnd(18)} ${String(a.rows).padStart(6)} → ${b.missing ? "MISSING" : b.missingColumns ? "missing cols " + b.missingColumns.join(",") : String(b.rows).padStart(6)}`);
      }
      const added = [...liveTables.keys()].filter((t) => !baseline.tables[t]);
      if (added.length) console.log(`(bảng mới, không so sánh: ${added.join(", ")})`);
      console.log(bad === 0 ? "\nTẤT CẢ BẢNG CŨ KHỚP 100%." : `\nCÓ ${bad} BẢNG KHÁC BIỆT!`);
      process.exitCode = bad === 0 ? 0 : 1;
    } else {
      for (const [t, v] of Object.entries(result.tables)) console.log(`${t.padEnd(18)} ${String(v.rows).padStart(6)}  ${v.md5}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Lỗi:", e.message);
  process.exit(2);
});
