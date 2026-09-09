/**
 * excelParser.ts
 * Đọc file .xlsx / .xls / .csv → trả về plain text (CSV-like) để feed vào Gemini.
 * Gemini không nhận file xlsx trực tiếp, nên ta convert sang text trước.
 */

import * as XLSX from "xlsx";

/**
 * Nhận Buffer của file xlsx/xls/csv,
 * trả về chuỗi CSV (tất cả các sheet, ngăn cách bởi header sheet name).
 */
export function parseExcelToText(buffer: Buffer, _filename?: string): string {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // header: 1 → mảng mảng (raw rows)
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });

    // Lọc dòng rỗng
    const filtered = csv
      .split("\n")
      .filter((line) => line.replace(/,/g, "").trim() !== "")
      .join("\n");

    if (filtered.trim()) {
      parts.push(`=== Sheet: ${sheetName} ===\n${filtered}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Kiểm tra file có phải Excel/CSV không (theo extension).
 */
export function isExcelOrCsv(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return ["xlsx", "xls", "csv"].includes(ext);
}

/**
 * Kiểm tra file PDF.
 */
export function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}
