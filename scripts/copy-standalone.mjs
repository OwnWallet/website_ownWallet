import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const standaloneDir = path.resolve(root, ".next/standalone");

if (fs.existsSync(standaloneDir)) {
  const publicSrc = path.resolve(root, "public");
  const publicDest = path.resolve(standaloneDir, "public");
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
    console.log("[copy-standalone] Copied public/ -> .next/standalone/public");
  }

  const staticSrc = path.resolve(root, ".next/static");
  const staticDest = path.resolve(standaloneDir, ".next/static");
  if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
    console.log("[copy-standalone] Copied .next/static -> .next/standalone/.next/static");
  }
}
