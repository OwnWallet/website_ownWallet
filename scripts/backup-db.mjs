#!/usr/bin/env node
/**
 * Backup toàn bộ DB bằng pg_dump (PostgreSQL 17, khớp server 17.x).
 *
 *   node scripts/backup-db.mjs [--copy-to <thư mục thứ hai>]
 *
 * Công cụ pg_dump được tìm theo thứ tự:
 *   1. biến môi trường PG_BIN (thư mục chứa pg_dump.exe / pg_dump)
 *   2. ../tools/pgsql/bin (bản portable cạnh thư mục dự án)
 *   3. Docker image postgres:17
 *
 * - Ghi backups/ownwallet-<timestamp>.dump (định dạng custom, khôi phục bằng pg_restore)
 * - Kiểm tra file đọc được bằng pg_restore --list
 * - Thông tin kết nối chỉ truyền qua biến môi trường PG*, không in ra log / không nằm trên command line.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Thiếu DATABASE_URL trong .env");
  process.exit(2);
}
const args = process.argv.slice(2);
const copyIdx = args.indexOf("--copy-to");
const copyTo = copyIdx >= 0 ? args[copyIdx + 1] : undefined;

const exe = process.platform === "win32" ? ".exe" : "";
const candidates = [process.env.PG_BIN, path.resolve("..", "tools", "pgsql", "bin")].filter(Boolean);
const pgBin = candidates.find((d) => fs.existsSync(path.join(d, "pg_dump" + exe)));

/** DATABASE_URL → biến môi trường libpq (tránh để mật khẩu trên command line). */
function libpqEnv(connectionString) {
  const u = new URL(connectionString);
  const env = {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
  };
  const sslmode = u.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

const dir = path.resolve("backups");
fs.mkdirSync(dir, { recursive: true });
const ts = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const fileName = `ownwallet-${ts}.dump`;
const filePath = path.join(dir, fileName);

function run(cmd, cmdArgs, { stdoutFile, env } = {}) {
  return new Promise((resolve, reject) => {
    const out = stdoutFile ? fs.openSync(stdoutFile, "w") : "pipe";
    const child = spawn(cmd, cmdArgs, { stdio: ["ignore", out, "pipe"], env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (typeof out === "number") fs.closeSync(out);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${path.basename(cmd)} exit ${code}: ${stderr.replaceAll(url, "<DATABASE_URL>")}`));
    });
  });
}

const DUMP_FLAGS = ["--format=custom", "--no-owner", "--no-privileges"];

async function main() {
  let list;
  if (pgBin) {
    console.log(`→ pg_dump (${pgBin}) → ${path.relative(process.cwd(), filePath)}`);
    await run(path.join(pgBin, "pg_dump" + exe), [...DUMP_FLAGS, "--file", filePath], { env: libpqEnv(url) });
    console.log("→ Kiểm tra file bằng pg_restore --list");
    list = await run(path.join(pgBin, "pg_restore" + exe), ["--list", filePath]);
  } else {
    const image = process.env.PG_DOCKER_IMAGE || "postgres:17";
    console.log(`→ pg_dump (docker ${image}) → ${path.relative(process.cwd(), filePath)}`);
    await run(
      "docker",
      ["run", "--rm", "-e", "PGURL", image, "sh", "-c", `pg_dump ${DUMP_FLAGS.join(" ")} --dbname="$PGURL"`],
      { stdoutFile: filePath, env: { PGURL: url } }
    );
    console.log("→ Kiểm tra file bằng pg_restore --list");
    list = await run("docker", ["run", "--rm", "-v", `${dir}:/b:ro`, image, "pg_restore", "--list", `/b/${fileName}`]);
  }

  const size = fs.statSync(filePath).size;
  if (size === 0) throw new Error("File backup rỗng");
  const tableData = list.split(/\r?\n/).filter((l) => / TABLE DATA public /.test(l));
  if (tableData.length === 0) throw new Error("Backup không chứa dữ liệu bảng nào");

  if (copyTo) {
    fs.mkdirSync(copyTo, { recursive: true });
    fs.copyFileSync(filePath, path.join(copyTo, fileName));
    console.log(`→ Đã sao thêm 1 bản vào ${copyTo}`);
  }

  console.log(`✔ Backup OK: ${fileName} (${(size / 1024).toFixed(0)} KB, ${tableData.length} bảng có dữ liệu)`);
  console.log(`BACKUP_FILE=${filePath}`);
}

main().catch((e) => {
  // Không để lại file dump dở dang có thể bị nhầm là backup hợp lệ.
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
  console.error("✖ Backup thất bại:", e.message);
  process.exit(1);
});
