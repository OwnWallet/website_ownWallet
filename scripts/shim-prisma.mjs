import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prismaBinPath = path.resolve(__dirname, "../node_modules/prisma/dist/prisma.js");

if (fs.existsSync(prismaBinPath)) {
  let content = fs.readFileSync(prismaBinPath, "utf8");
  const shimMarker = "/* PRISMA_MIGRATE_SHIM */";
  if (!content.includes(shimMarker)) {
    const shimCode = `${shimMarker}
(() => {
  const argv = process.argv;
  const mIdx = argv.indexOf("migrate");
  if (mIdx !== -1 && argv[mIdx + 1] === "deploy") {
    if (!process.env.DATABASE_URL) {
      console.log("[shim-prisma] DATABASE_URL is not set, skipping migration");
      process.exit(0);
    }
    argv.splice(mIdx, 2, "db", "migrate");
    const sIdx = argv.indexOf("--schema");
    if (sIdx !== -1) {
      argv.splice(sIdx, 2);
    }
  }
})();
`;
    content = content.replace(/^(#!.+?\n)/, `$1${shimCode}`);
    fs.writeFileSync(prismaBinPath, content, "utf8");
    console.log("[shim-prisma] Successfully patched Prisma CLI for Prisma 8 compatibility (migrate deploy -> db migrate)");
  }
}
