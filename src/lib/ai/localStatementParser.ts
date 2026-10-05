/**
 * localStatementParser.ts
 * Bộ phân tích sao kê ngân hàng PDF (TPBank, Techcombank & phổ thông) và bảng tính Excel/CSV hoàn toàn nội bộ (Offline / 0 AI dependency).
 * Sử dụng tọa độ bảng (X, Y) kết hợp giải mã ToUnicode CMap và bộ từ điển phân loại danh mục tiếng Việt có dấu / không dấu.
 */

import * as XLSX from "xlsx";
import {
  extractPositionedItemsFromPdfBuffer,
  extractTextFromPdfBuffer,
  type PdfPositionedItem,
} from "@/lib/ai/pdfTextExtractor";
import { ParsedTransactionSchema, type ParsedTransaction } from "@/schemas/ai-import";

export interface LocalParseResult {
  transactions: ParsedTransaction[];
  totalFound: number;
  skipped: number;
  detectedBank?: string;
  detectedAccountNumber?: string;
}

/**
 * Chuẩn hóa chuỗi tiếng Việt về chữ thường không dấu để so khớp từ khóa sao kê ngân hàng
 */
function normalizeVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface CategoryRule {
  canonicalName: string;
  aliases: string[];
  type: "EXPENSE" | "INCOME";
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    canonicalName: "Ăn uống",
    aliases: ["an uong", "food", "dining", "nha hang", "di cho", "cafe", "ca phe"],
    type: "EXPENSE",
    keywords: [
      "an sang",
      "an trua",
      "an toi",
      "an dem",
      "an vat",
      "banh cuon",
      "banh mi",
      "banh bao",
      "banh xeo",
      "xoi",
      "bun",
      "pho",
      "hu tieu",
      "mi cay",
      "mi quang",
      "com tam",
      "com trua",
      "com ga",
      "com van phong",
      "chao",
      "lau",
      "nuong",
      "bbq",
      "buffet",
      "ga ran",
      "jolibee",
      "jollibee",
      "kfc",
      "lotteria",
      "mcdonald",
      "pizza",
      "burger",
      "sushi",
      "kem",
      "tra sua",
      "cafe",
      "ca phe",
      "coffee",
      "highlands",
      "phuc long",
      "starbucks",
      "the coffee house",
      "katinat",
      "phe la",
      "mixue",
      "gong cha",
      "koi the",
      "mua toi",
      "hanh tim",
      "mua rau",
      "mua thit",
      "mua ca",
      "mua trai cay",
      "hoa qua",
      "di cho",
      "sieu thi",
      "bach hoa xanh",
      "winmart",
      "coopmart",
      "big c",
      "aeon",
      "emart",
      "circle k",
      "gs25",
      "familymart",
      "7 eleven",
      "grabfood",
      "shopeefood",
      "befood",
      "nhau",
      "bia",
      "nuoc ngot",
    ],
  },
  {
    canonicalName: "Di chuyển",
    aliases: ["di chuyen", "giao thong", "xe co", "xang xe", "transport"],
    type: "EXPENSE",
    keywords: [
      "tien xang",
      "do xang",
      "petrolimex",
      "pvoil",
      "xang dau",
      "grab",
      "xanh sm",
      "gsm",
      "be car",
      "bebike",
      "mai linh",
      "vinasun",
      "taxi",
      "ve xe",
      "ve tau",
      "ve may bay",
      "vietjet",
      "vietnam airlines",
      "bamboo airways",
      "gui xe",
      "giu xe",
      "do xe",
      "tram thu phi",
      "vetc",
      "epass",
      "sua xe",
      "thay nhot",
      "bao duong xe",
      "rua xe",
      "grabcar",
      "grabbike",
    ],
  },
  {
    canonicalName: "Mua sắm",
    aliases: ["mua sam", "shopping", "quan ao", "thoi trang"],
    type: "EXPENSE",
    keywords: [
      "shopeepay",
      "nap vi shopeepay",
      "shopee",
      "lazada",
      "tiki",
      "tiktok shop",
      "tiktok",
      "mua sam",
      "quan ao",
      "ao quan",
      "giay dep",
      "tui xach",
      "my pham",
      "son moi",
      "nuoc hoa",
      "skincare",
      "hasaki",
      "guardian",
      "watsons",
      "uniqlo",
      "zara",
      "cellphones",
      "the gioi di dong",
      "dien may xanh",
      "fpt shop",
      "phong vu",
      "gearvn",
      "mainboard",
      "asus",
      "sua may tinh",
      "laptop",
    ],
  },
  {
    canonicalName: "Hóa đơn",
    aliases: ["hoa don", "dien nuoc", "tien nha", "utilities", "bills"],
    type: "EXPENSE",
    keywords: [
      "tien dien",
      "evn",
      "tien nuoc",
      "cap nuoc",
      "tien mang",
      "internet",
      "wifi",
      "viettel",
      "vinaphone",
      "mobifone",
      "vnpt",
      "fpt telecom",
      "nap the",
      "cuoc dien thoai",
      "tien nha",
      "thue nha",
      "tien phong",
      "tien tro",
      "phi quan ly",
      "phi dich vu",
      "chung cu",
      "icloud",
      "google one",
    ],
  },
  {
    canonicalName: "Giải trí",
    aliases: ["giai tri", "entertainment", "du lich"],
    type: "EXPENSE",
    keywords: [
      "cgv",
      "lotte cinema",
      "galaxy cinema",
      "bhd star",
      "beta cinemas",
      "xem phim",
      "ve phim",
      "netflix",
      "spotify",
      "youtube premium",
      "steam",
      "playstation",
      "game",
      "karaoke",
      "bida",
      "billard",
      "bowling",
      "du lich",
      "khach san",
      "homestay",
      "resort",
      "booking",
      "agoda",
      "traveloka",
      "klook",
    ],
  },
  {
    canonicalName: "Sức khỏe",
    aliases: ["suc khoe", "y te", "thuoc", "health"],
    type: "EXPENSE",
    keywords: [
      "mua thuoc",
      "tien thuoc",
      "nha thuoc",
      "long chau",
      "pharmacity",
      "an khang",
      "kham benh",
      "vien phi",
      "benh vien",
      "phong kham",
      "nha khoa",
      "rang ham mat",
      "xet nghiem",
      "tiem chung",
      "vac xin",
      "vaccine",
      "bao hiem y te",
      "bhyt",
      "gym",
      "yoga",
      "pilates",
      "the thao",
      "cau long",
      "bong da",
      "pickleball",
      "boi loi",
    ],
  },
  {
    canonicalName: "Lương",
    aliases: ["luong", "salary", "payroll"],
    type: "INCOME",
    keywords: [
      "luong",
      "thanh toan luong",
      "tra luong",
      "salary",
      "payroll",
      "tam ung luong",
    ],
  },
  {
    canonicalName: "Thưởng",
    aliases: ["thuong", "bonus"],
    type: "INCOME",
    keywords: [
      "thuong",
      "bonus",
      "hoa hong",
      "commission",
      "li xi",
      "mung tuoi",
    ],
  },
  {
    canonicalName: "Freelance",
    aliases: ["freelance", "lam them", "du an"],
    type: "INCOME",
    keywords: [
      "freelance",
      "nhan tien du an",
      "thanh toan hop dong",
      "cat xe",
      "royalty",
      "affiliate",
    ],
  },
];

/**
 * Tìm tên danh mục khớp nhất trong danh sách availableCategories của người dùng
 */
function resolveUserCategoryName(
  desiredCanonical: string,
  aliases: string[],
  availableCategories: string[],
  fallbackDefault: string
): string {
  if (!availableCategories || availableCategories.length === 0) {
    return desiredCanonical;
  }

  const desiredNorm = normalizeVietnamese(desiredCanonical);

  // 1. Khớp chính xác (không phân biệt hoa thường / dấu)
  for (const cat of availableCategories) {
    if (normalizeVietnamese(cat) === desiredNorm) {
      return cat;
    }
  }

  // 2. Khớp theo alias
  for (const alias of aliases) {
    const aliasNorm = normalizeVietnamese(alias);
    for (const cat of availableCategories) {
      const catNorm = normalizeVietnamese(cat);
      if (catNorm === aliasNorm || catNorm.includes(aliasNorm)) {
        return cat;
      }
    }
  }

  // 3. Khớp fallbackDefault ("Chi tiêu khác" / "Thu nhập khác")
  const fallbackNorm = normalizeVietnamese(fallbackDefault);
  for (const cat of availableCategories) {
    if (normalizeVietnamese(cat) === fallbackNorm) {
      return cat;
    }
  }

  return desiredCanonical;
}

/**
 * Tự động phân loại danh mục giao dịch dựa trên nội dung diễn giải (hỗ trợ tiếng Việt không dấu & có dấu)
 */
export function classifyCategoryByKeywords(
  note: string,
  type: "INCOME" | "EXPENSE",
  availableCategories: string[]
): { categoryName: string; confidence: number } {
  const normNote = " " + normalizeVietnamese(note) + " ";

  for (const rule of CATEGORY_RULES) {
    if (rule.type !== type) continue;

    for (const kw of rule.keywords) {
      const normKw = normalizeVietnamese(kw);
      const rgx = new RegExp(`(?:^|\\s)${normKw}(?:\\s|$)`);
      if (rgx.test(normNote)) {
        const fallback = type === "INCOME" ? "Thu nhập khác" : "Chi tiêu khác";
        return {
          categoryName: resolveUserCategoryName(
            rule.canonicalName,
            rule.aliases,
            availableCategories,
            fallback
          ),
          confidence: 0.95,
        };
      }
    }
  }

  const defaultCanonical = type === "INCOME" ? "Thu nhập khác" : "Chi tiêu khác";
  const defaultAliases =
    type === "INCOME"
      ? ["thu nhap khac", "other income", "khac"]
      : ["chi tieu khac", "other expense", "khac"];

  return {
    categoryName: resolveUserCategoryName(
      defaultCanonical,
      defaultAliases,
      availableCategories,
      defaultCanonical
    ),
    confidence: 0.85,
  };
}

/**
 * Chuyển chuỗi ngày giờ Việt Nam ("DD/MM/YYYY HH:mm:ss", "DD/MM/YYYY", "YYYY-MM-DD") sang ISO 8601 (+07:00)
 */
export function parseVietnameseDateToIso(raw: string): string | null {
  const cleaned = raw.trim();

  // 1. DD/MM/YYYY [HH:mm[:ss]] hoặc DD-MM-YYYY [HH:mm[:ss]] (phải khớp trọn vẹn chuỗi ngày giờ)
  const dmyMatch = cleaned.match(
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    const hour = (dmyMatch[4] ?? "00").padStart(2, "0");
    const minute = (dmyMatch[5] ?? "00").padStart(2, "0");
    const second = (dmyMatch[6] ?? "00").padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`;
  }

  // 2. YYYY-MM-DD [HH:mm[:ss]]
  const ymdMatch = cleaned.match(
    /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    const hour = (ymdMatch[4] ?? "00").padStart(2, "0");
    const minute = (ymdMatch[5] ?? "00").padStart(2, "0");
    const second = (ymdMatch[6] ?? "00").padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`;
  }

  return null;
}

/**
 * Tìm ngày giờ chi tiết "DD/MM/YYYY HH:mm:ss" nhúng bên trong nội dung diễn giải (thường gặp ở Techcombank / ShopeePay)
 */
function extractEmbeddedDateTimeIso(noteText: string, baseIsoDate: string): string {
  const match = noteText.match(
    /\b(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\b/
  );
  if (!match) return baseIsoDate;

  const embeddedDatePrefix = `${match[3]}-${match[2]}-${match[1]}`;
  if (baseIsoDate.startsWith(embeddedDatePrefix)) {
    return `${embeddedDatePrefix}T${match[4]}:${match[5]}:${match[6]}+07:00`;
  }
  return baseIsoDate;
}

/**
 * Chuyển chuỗi tiền tệ ("35,000", "1.000.000", "86,930 VND") thành số dương.
 * Kiểm tra nghiêm ngặt để KHÔNG BAO GIỜ nhận nhầm mã bút toán kiểu "FT26246040431935\BNK".
 */
function parseCurrencyNumber(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return NaN;

  // Loại bỏ hậu tố tiền tệ hợp lệ nếu có
  const withoutCurrency = trimmed.replace(/\s*(?:VND|VNĐ|đ)\s*$/i, "").trim();

  // Chỉ chấp nhận chuỗi thuần số có dấu phẩy/chấm phân cách hàng nghìn
  if (!/^[\+\-]?\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{1,2})?$|^\d+$/.test(withoutCurrency)) {
    return NaN;
  }

  const numericOnly = withoutCurrency.replace(/[,\.\+\-]/g, "");
  const val = Number(numericOnly);
  return isNaN(val) ? NaN : Math.abs(val);
}

/**
 * Kiểm tra xem một dòng có phải là dòng tổng kết / chân trang / tiêu đề bảng cần dừng gộp diễn giải không
 */
function isFooterOrHeaderRowText(rowText: string): boolean {
  const patterns = [
    /Tổng phát sinh/i,
    /Total amount incurred/i,
    /Cộng doanh số/i,
    /Total volume/i,
    /Số dư cuối kỳ/i,
    /Closing balance/i,
    /Ending balance/i,
    /Số dư đầu kỳ/i,
    /Opening balance/i,
    /Beginning balance/i,
    /Ngày thực hiện/i,
    /Ngày giao dịch/i,
    /Transaction Date/i,
    /Reference Number/i,
    /Remitter Bank/i,
    /Bảng sao kê được in tự động/i,
    /Statement to be printed automatically/i,
    /Phiếu này được in từ dịch vụ ngân hàng điện tử/i,
    /This document was generated from Techcombank/i,
    /Diễn giải\/\s*Description:/i,
    /Trang số:/i,
    /SAO KÊ TÀI KHOẢN/i,
    /SỔ PHỤ KIÊM PHIẾU BÁO NỢ/i,
    /ACCOUNT STATEMENT/i,
    /BANK STATEMENT/i,
  ];
  return patterns.some((p) => p.test(rowText));
}

/**
 * Phân tích chuyên biệt cho Sao kê Techcombank (8 cột ngang, căn giữa theo chiều dọc từng dòng giao dịch):
 * Cột 1: Ngày giao dịch (X < 110)
 * Cột 2: Đối tác / Remitter (110 <= X < 205)
 * Cột 3: NH Đối tác / Remitter Bank (205 <= X < 310)
 * Cột 4: Diễn giải / Details (310 <= X < 425)
 * Cột 5: Số bút toán / Transaction No (425 <= X < 535)
 * Cột 6: Nợ TKTT / Debit (535 <= X < 640)
 * Cột 7: Có TKTT / Credit (640 <= X < 740)
 * Cột 8: Số dư / Balance (X >= 740)
 */
function parseTechcombankPositionedItems(
  items: PdfPositionedItem[],
  availableCategories: string[]
): LocalParseResult | null {
  // Xác định ranh giới cột mặc định chuẩn Techcombank (và tinh chỉnh động từ dòng tiêu đề nếu có)
  const dateMaxX = 110;
  const remitterMaxX = 205;
  const bankMaxX = 310;
  const detailsMaxX = 425;
  let txNoMaxX = 535;
  let debitMaxX = 640;
  let creditMaxX = 740;

  const debitHeader = items.find((it) => /^(?:Nợ TKTT|Debit)$/i.test(it.text));
  const creditHeader = items.find((it) => /^(?:Có TKTT|Credit)$/i.test(it.text));
  const balanceHeader = items.find((it) => /^(?:Số dư \(2\)|Balance)$/i.test(it.text));
  const txNoHeader = items.find((it) => /^(?:Số bút toán|Transaction No)$/i.test(it.text));

  if (txNoHeader && debitHeader) {
    txNoMaxX = (txNoHeader.x + debitHeader.x) / 2 + 15;
  }
  if (debitHeader && creditHeader) {
    debitMaxX = (debitHeader.x + creditHeader.x) / 2 + 15;
  }
  if (creditHeader && balanceHeader) {
    creditMaxX = (creditHeader.x + balanceHeader.x) / 2 + 15;
  }

  // Nhóm các phần tử theo từng trang
  const pagesMap = new Map<number, PdfPositionedItem[]>();
  for (const it of items) {
    const arr = pagesMap.get(it.page) ?? [];
    arr.push(it);
    pagesMap.set(it.page, arr);
  }

  interface RawTcbTx {
    recordedAt: string;
    remitter: string;
    remitterBank: string;
    details: string;
    txNo: string;
    debitAmount: number | null;
    creditAmount: number | null;
  }

  const extractedTxs: RawTcbTx[] = [];

  for (const [, pageItems] of pagesMap.entries()) {
    // 1. Tìm giới hạn trên (topY) và giới hạn dưới (bottomY) của vùng bảng giao dịch trên trang này
    let topY = Infinity;
    let bottomY = 50; // Luôn loại bỏ dòng chân trang ở Y < 50 (chứa giờ in 05/10/2026 22:56:24)

    for (const it of pageItems) {
      if (
        it.text.length < 45 &&
        /^(?:Số dư đầu kỳ|Opening balance|Transaction Date|Ngày giao dịch \(1\)|Remitter Bank)/i.test(
          it.text
        )
      ) {
        topY = Math.min(topY, it.y - 6);
      }
      if (
        /Cộng doanh số|Total volume|Số dư cuối kỳ|Ending balance|Diễn giải\/\s*Description|^\(1\):|^\(2\):|Phiếu này được in từ dịch vụ|This document was generated/i.test(
          it.text
        )
      ) {
        bottomY = Math.max(bottomY, it.y + 6);
      }
    }

    const tableItems = pageItems.filter((it) => it.y < topY && it.y > bottomY);
    if (tableItems.length === 0) continue;

    // 2. Tìm các mỏ neo giao dịch (Transaction Anchors):
    // Mỗi dòng giao dịch có 1 ô Ngày (DD/MM/YYYY) ở cột 1 (X < dateMaxX)
    // VÀ ở cùng tọa độ Y (sai số <= 3.5pt) phải có Số tiền Nợ, Số tiền Có, hoặc Số dư
    const dateCandidates = tableItems.filter(
      (it) => it.x < dateMaxX && parseVietnameseDateToIso(it.text) !== null
    );

    const anchors: { y: number; isoDate: string }[] = [];
    for (const dc of dateCandidates) {
      const isoDate = parseVietnameseDateToIso(dc.text);
      if (!isoDate) continue;

      const hasNumericOnSameCenterY = tableItems.some(
        (other) =>
          other.x >= txNoMaxX &&
          Math.abs(other.y - dc.y) <= 3.5 &&
          !isNaN(parseCurrencyNumber(other.text))
      );

      if (hasNumericOnSameCenterY) {
        anchors.push({ y: dc.y, isoDate });
      }
    }

    // Sắp xếp các mỏ neo từ trên xuống dưới (Y giảm dần)
    anchors.sort((a, b) => b.y - a.y);
    if (anchors.length === 0) continue;

    // 3. Phân bổ từng phần tử trong vùng bảng về mỏ neo giao dịch gần nhất theo trục Y
    // (Trong Techcombank, các ô 2-3 dòng được căn giữa theo Y của mỏ neo, lệch tối đa ±12pt so với tâm dòng)
    const buckets: PdfPositionedItem[][] = anchors.map(() => []);

    for (const it of tableItems) {
      let bestIdx = -1;
      let minDeltaY = Infinity;

      for (let i = 0; i < anchors.length; i++) {
        const dy = Math.abs(it.y - anchors[i].y);
        if (dy < minDeltaY) {
          minDeltaY = dy;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1 && minDeltaY <= 16) {
        buckets[bestIdx].push(it);
      }
    }

    // 4. Trích xuất dữ liệu từng giao dịch từ bucket tương ứng
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const cellItems = buckets[i];

      // Sắp xếp từ trên xuống dưới (Y giảm dần), cùng Y thì từ trái sang phải (X tăng dần)
      cellItems.sort((a, b) =>
        Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x
      );

      const remitter = cellItems
        .filter((c) => c.x >= dateMaxX && c.x < remitterMaxX)
        .map((c) => c.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const remitterBank = cellItems
        .filter((c) => c.x >= remitterMaxX && c.x < bankMaxX)
        .map((c) => c.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const details = cellItems
        .filter((c) => c.x >= bankMaxX && c.x < detailsMaxX)
        .map((c) => c.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const txNo = cellItems
        .filter((c) => c.x >= detailsMaxX && c.x < txNoMaxX)
        .map((c) => c.text)
        .join(" ")
        .trim();

      const debitCells = cellItems.filter(
        (c) => c.x >= txNoMaxX && c.x < debitMaxX
      );
      const creditCells = cellItems.filter(
        (c) => c.x >= debitMaxX && c.x < creditMaxX
      );

      let debitAmount: number | null = null;
      for (const dc of debitCells) {
        const val = parseCurrencyNumber(dc.text);
        if (!isNaN(val) && val > 0) {
          debitAmount = val;
          break;
        }
      }

      let creditAmount: number | null = null;
      for (const cc of creditCells) {
        const val = parseCurrencyNumber(cc.text);
        if (!isNaN(val) && val > 0) {
          creditAmount = val;
          break;
        }
      }

      const finalRecordedAt = extractEmbeddedDateTimeIso(details, anchor.isoDate);

      extractedTxs.push({
        recordedAt: finalRecordedAt,
        remitter,
        remitterBank,
        details,
        txNo,
        debitAmount,
        creditAmount,
      });
    }
  }

  if (extractedTxs.length === 0) return null;

  const validTransactions: ParsedTransaction[] = [];
  let skipped = 0;

  for (const tx of extractedTxs) {
    const isIncome = tx.creditAmount !== null && tx.creditAmount > 0;
    const amount = isIncome ? tx.creditAmount : tx.debitAmount;
    if (!amount || amount <= 0) {
      skipped++;
      continue;
    }

    const type: "INCOME" | "EXPENSE" = isIncome ? "INCOME" : "EXPENSE";

    // Kết hợp Diễn giải và Đối tác nếu Đối tác có thông tin bổ sung chưa nằm trong Diễn giải
    let fullNote = tx.details || tx.txNo || "Giao dịch Techcombank";
    if (
      tx.remitter &&
      !normalizeVietnamese(fullNote).includes(normalizeVietnamese(tx.remitter))
    ) {
      fullNote = `${fullNote} (${tx.remitter})`;
    }

    const { categoryName, confidence } = classifyCategoryByKeywords(
      `${fullNote} ${tx.remitter}`,
      type,
      availableCategories
    );

    const validated = ParsedTransactionSchema.safeParse({
      amount,
      type,
      categoryName,
      note: fullNote,
      recordedAt: tx.recordedAt,
      confidence,
    });

    if (validated.success) {
      validTransactions.push(validated.data);
    } else {
      skipped++;
    }
  }

  if (validTransactions.length === 0) return null;

  return {
    transactions: validTransactions,
    totalFound: extractedTxs.length,
    skipped,
  };
}

/**
 * Phân tích trực tiếp file PDF Sao kê Ngân hàng (Tự động nhận diện Techcombank, TPBank & mẫu bảng phổ thông)
 */
export function parseTpBankPdfLocally(
  buffer: Buffer,
  availableCategories: string[]
): LocalParseResult | null {
  const items = extractPositionedItemsFromPdfBuffer(buffer);
  if (items.length === 0) {
    return null;
  }

  const fullDocumentText = items.map((it) => it.text).join(" ");

  // Trích xuất Số tài khoản từ phần Header của sao kê (ví dụ: 100110122003 hoặc 53510122003)
  let detectedAccountNumber: string | undefined;
  const accMatch =
    fullDocumentText.match(/(?:Account\s*no\.?|Account's\s*number|Số tài khoản)\s*:?\s*(\d{8,16})/i) ||
    fullDocumentText.match(/\b(\d{10,14})\b/);
  if (accMatch) {
    detectedAccountNumber = accMatch[1];
  }

  // ── NHÁNH 1: Sao kê Techcombank (Sổ phụ kiêm phiếu báo Nợ/Có - 8 cột ngang) ──
  const isTechcombankStatement =
    /TECHCOMBANK|KỸ THƯƠNG VIỆT NAM|SỔ PHỤ KIÊM PHIẾU BÁO NỢ|Nợ TKTT|Có TKTT|Remitter Bank/i.test(
      fullDocumentText
    );

  if (isTechcombankStatement) {
    const tcbResult = parseTechcombankPositionedItems(items, availableCategories);
    if (tcbResult && tcbResult.transactions.length > 0) {
      return {
        ...tcbResult,
        detectedBank: "Techcombank",
        detectedAccountNumber,
      };
    }
  }

  const detectedBank = /Tiên Phong|TPBank/i.test(fullDocumentText) ? "TPBank" : undefined;

  // ── NHÁNH 2: Sao kê TPBank (6 cột dọc: Ngày thực hiện | Số GD | Diễn giải | Nợ | Có | Số dư) ──
  const rows: { page: number; y: number; cells: PdfPositionedItem[] }[] = [];
  for (const item of items) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && lastRow.page === item.page && Math.abs(lastRow.y - item.y) <= 3.5) {
      lastRow.cells.push(item);
    } else {
      rows.push({ page: item.page, y: item.y, cells: [item] });
    }
  }

  for (const r of rows) {
    r.cells.sort((a, b) => a.x - b.x);
  }

  const dateMaxX = 115;
  const refMaxX = 203;
  let descMaxX = 380;
  let debitMaxX = 444;
  let creditMaxX = 508;

  for (const r of rows) {
    const fullRow = r.cells.map((c) => c.text).join(" ");
    if (/Debit/i.test(fullRow) && /Credit/i.test(fullRow)) {
      const debitCell = r.cells.find((c) => /^Debit$/i.test(c.text));
      const creditCell = r.cells.find((c) => /^Credit$/i.test(c.text));
      const balanceCell = r.cells.find((c) => /^Balance$/i.test(c.text));
      if (debitCell) {
        descMaxX = Math.max(250, debitCell.x - 20);
      }
      if (debitCell && creditCell) {
        debitMaxX = (debitCell.x + creditCell.x) / 2;
      }
      if (creditCell && balanceCell) {
        creditMaxX = (creditCell.x + balanceCell.x) / 2;
      }
      break;
    }
  }

  interface PendingTx {
    recordedAt: string;
    refNo: string;
    explanationParts: string[];
    debitAmount: number | null;
    creditAmount: number | null;
  }

  const parsedPending: PendingTx[] = [];
  let currentTx: PendingTx | null = null;
  let insideTable = false;

  for (const r of rows) {
    if (r.y < 40) continue; // Bỏ qua dòng chân trang sát mép dưới
    const rowJoined = r.cells.map((c) => c.text).join(" ");

    if (isFooterOrHeaderRowText(rowJoined)) {
      if (/Ngày thực hiện|Transaction Date/i.test(rowJoined)) {
        insideTable = true;
      } else if (
        /Tổng phát sinh|Total amount incurred|Cộng doanh số|Total volume|Số dư cuối kỳ|Closing balance|Ending balance|Trang số:/i.test(
          rowJoined
        )
      ) {
        if (currentTx) {
          parsedPending.push(currentTx);
          currentTx = null;
        }
        insideTable = false;
      }
      continue;
    }

    const dateCells = r.cells.filter((c) => c.x < dateMaxX);
    const dateText = dateCells.map((c) => c.text).join(" ").trim();
    const isoDate = dateText ? parseVietnameseDateToIso(dateText) : null;

    if (isoDate) {
      insideTable = true;
      if (currentTx) {
        parsedPending.push(currentTx);
      }

      const refText = r.cells
        .filter((c) => c.x >= dateMaxX && c.x < refMaxX)
        .map((c) => c.text)
        .join(" ")
        .trim();

      const descText = r.cells
        .filter((c) => c.x >= refMaxX && c.x < descMaxX)
        .map((c) => c.text)
        .join(" ")
        .trim();

      const debitText = r.cells
        .filter((c) => c.x >= descMaxX && c.x < debitMaxX)
        .map((c) => c.text)
        .join("")
        .trim();

      const creditText = r.cells
        .filter((c) => c.x >= debitMaxX && c.x < creditMaxX)
        .map((c) => c.text)
        .join("")
        .trim();

      const debitVal = debitText ? parseCurrencyNumber(debitText) : NaN;
      const creditVal = creditText ? parseCurrencyNumber(creditText) : NaN;

      currentTx = {
        recordedAt: isoDate,
        refNo: refText,
        explanationParts: descText ? [descText] : [],
        debitAmount: !isNaN(debitVal) && debitVal > 0 ? debitVal : null,
        creditAmount: !isNaN(creditVal) && creditVal > 0 ? creditVal : null,
      };
    } else if (insideTable && currentTx) {
      const contDesc = r.cells
        .filter((c) => c.x >= refMaxX - 10 && c.x < descMaxX)
        .map((c) => c.text)
        .join(" ")
        .trim();

      if (contDesc) {
        currentTx.explanationParts.push(contDesc);
      }

      if (currentTx.debitAmount === null && currentTx.creditAmount === null) {
        const debitText = r.cells
          .filter((c) => c.x >= descMaxX && c.x < debitMaxX)
          .map((c) => c.text)
          .join("")
          .trim();
        const creditText = r.cells
          .filter((c) => c.x >= debitMaxX && c.x < creditMaxX)
          .map((c) => c.text)
          .join("")
          .trim();
        const dVal = debitText ? parseCurrencyNumber(debitText) : NaN;
        const cVal = creditText ? parseCurrencyNumber(creditText) : NaN;
        if (!isNaN(dVal) && dVal > 0) currentTx.debitAmount = dVal;
        if (!isNaN(cVal) && cVal > 0) currentTx.creditAmount = cVal;
      }
    }
  }

  if (currentTx) {
    parsedPending.push(currentTx);
  }

  if (parsedPending.length === 0) {
    return parseGenericTextPdfLocally(buffer, availableCategories);
  }

  const validTransactions: ParsedTransaction[] = [];
  let skipped = 0;

  for (const item of parsedPending) {
    const isIncome = item.creditAmount !== null && item.creditAmount > 0;
    const amount = isIncome ? item.creditAmount : item.debitAmount;
    if (!amount || amount <= 0) {
      skipped++;
      continue;
    }

    const type: "INCOME" | "EXPENSE" = isIncome ? "INCOME" : "EXPENSE";
    const fullNote = item.explanationParts.join(" ").replace(/\s+/g, " ").trim() || item.refNo;
    const { categoryName, confidence } = classifyCategoryByKeywords(
      fullNote,
      type,
      availableCategories
    );

    const candidate = {
      amount,
      type,
      categoryName,
      note: fullNote,
      recordedAt: item.recordedAt,
      confidence,
    };

    const validated = ParsedTransactionSchema.safeParse(candidate);
    if (validated.success) {
      validTransactions.push(validated.data);
    } else {
      skipped++;
    }
  }

  if (validTransactions.length === 0) {
    return null;
  }

  return {
    transactions: validTransactions,
    totalFound: parsedPending.length,
    skipped,
    detectedBank,
    detectedAccountNumber,
  };
}

/**
 * Fallback phân tích văn bản dòng cho các file PDF sao kê có định dạng bảng văn bản khác
 */
function parseGenericTextPdfLocally(
  buffer: Buffer,
  availableCategories: string[]
): LocalParseResult | null {
  const rawText = extractTextFromPdfBuffer(buffer);
  if (!rawText) return null;

  const lines = rawText.split("\n");
  const transactions: ParsedTransaction[] = [];
  let skipped = 0;

  for (const line of lines) {
    if (isFooterOrHeaderRowText(line)) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 3) continue;

    const isoDate = parseVietnameseDateToIso(parts[0]);
    if (!isoDate) continue;

    const numericCells: { idx: number; val: number; raw: string }[] = [];
    for (let i = parts.length - 1; i >= 1; i--) {
      const val = parseCurrencyNumber(parts[i]);
      if (!isNaN(val) && val > 0) {
        numericCells.unshift({ idx: i, val, raw: parts[i] });
      }
    }

    if (numericCells.length === 0) continue;

    const amountCell =
      numericCells.length >= 2 ? numericCells[numericCells.length - 2] : numericCells[0];
    const type: "INCOME" | "EXPENSE" = amountCell.raw.trim().startsWith("+")
      ? "INCOME"
      : "EXPENSE";

    const descParts = parts.slice(1, amountCell.idx).filter((p) => !/^\d{6,}$/.test(p));
    const note = descParts.join(" ").trim() || parts[1] || "Giao dịch sao kê";
    const { categoryName, confidence } = classifyCategoryByKeywords(
      note,
      type,
      availableCategories
    );

    const validated = ParsedTransactionSchema.safeParse({
      amount: amountCell.val,
      type,
      categoryName,
      note,
      recordedAt: isoDate,
      confidence,
    });

    if (validated.success) {
      transactions.push(validated.data);
    } else {
      skipped++;
    }
  }

  if (transactions.length === 0) return null;

  return {
    transactions,
    totalFound: transactions.length + skipped,
    skipped,
  };
}

/**
 * Phân tích trực tiếp file Excel / CSV không cần AI
 */
export function parseExcelOrCsvLocally(
  buffer: Buffer,
  availableCategories: string[]
): LocalParseResult | null {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const transactions: ParsedTransaction[] = [];
    let totalFound = 0;
    let skipped = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
      if (rows.length < 2) continue;

      let headerIdx = -1;
      let dateCol = -1;
      let descCol = -1;
      let amountCol = -1;
      let debitCol = -1;
      let creditCol = -1;
      let typeCol = -1;
      let catCol = -1;

      for (let r = 0; r < Math.min(rows.length, 15); r++) {
        const row = rows[r].map((c) => normalizeVietnamese(String(c ?? "")));
        const dIdx = row.findIndex((c) =>
          /\b(ngay|date|thoi gian|time|transaction date)\b/.test(c)
        );
        const aIdx = row.findIndex((c) =>
          /\b(so tien|amount|gia tri|ps no|ps co|ghi no|ghi co|no|co|debit|credit)\b/.test(c)
        );

        if (dIdx !== -1 && aIdx !== -1) {
          headerIdx = r;
          dateCol = dIdx;
          descCol = row.findIndex((c) =>
            /\b(dien giai|mo ta|noi dung|ghi chu|note|description|explanation)\b/.test(c)
          );
          debitCol = row.findIndex((c) => /\b(no|ghi no|ps no|debit|chi)\b/.test(c));
          creditCol = row.findIndex((c) => /\b(co|ghi co|ps co|credit|thu)\b/.test(c));
          amountCol = row.findIndex((c) => /\b(so tien|amount|gia tri)\b/.test(c));
          typeCol = row.findIndex((c) => /\b(loai|type|phan loai)\b/.test(c));
          catCol = row.findIndex((c) => /\b(danh muc|category|nhom)\b/.test(c));
          break;
        }
      }

      if (headerIdx === -1) continue;

      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const rawDate = row[dateCol];
        let isoDate: string | null = null;
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
          isoDate = rawDate.toISOString();
        } else if (rawDate) {
          isoDate = parseVietnameseDateToIso(String(rawDate));
        }

        if (!isoDate) continue;

        let amount = 0;
        let type: "INCOME" | "EXPENSE" = "EXPENSE";

        if (debitCol !== -1 && creditCol !== -1) {
          const dVal = parseCurrencyNumber(String(row[debitCol] ?? ""));
          const cVal = parseCurrencyNumber(String(row[creditCol] ?? ""));
          if (!isNaN(cVal) && cVal > 0) {
            amount = cVal;
            type = "INCOME";
          } else if (!isNaN(dVal) && dVal > 0) {
            amount = dVal;
            type = "EXPENSE";
          }
        } else if (amountCol !== -1) {
          const rawAmtStr = String(row[amountCol] ?? "").trim();
          const val = parseCurrencyNumber(rawAmtStr);
          if (!isNaN(val) && val > 0) {
            amount = val;
            if (rawAmtStr.startsWith("+")) {
              type = "INCOME";
            } else if (typeCol !== -1) {
              const tNorm = normalizeVietnamese(String(row[typeCol] ?? ""));
              if (/\b(thu|income|co|credit|nap)\b/.test(tNorm)) {
                type = "INCOME";
              }
            }
          }
        }

        if (amount <= 0) continue;
        totalFound++;

        const note =
          descCol !== -1 ? String(row[descCol] ?? "").trim() : "Giao dịch nhập từ bảng tính";
        const explicitCat = catCol !== -1 ? String(row[catCol] ?? "").trim() : "";

        const { categoryName, confidence } = explicitCat
          ? { categoryName: explicitCat, confidence: 1.0 }
          : classifyCategoryByKeywords(note, type, availableCategories);

        const validated = ParsedTransactionSchema.safeParse({
          amount,
          type,
          categoryName,
          note,
          recordedAt: isoDate,
          confidence,
        });

        if (validated.success) {
          transactions.push(validated.data);
        } else {
          skipped++;
        }
      }
    }

    if (transactions.length === 0) return null;
    return { transactions, totalFound, skipped };
  } catch (err) {
    console.warn("[Local Excel Parser] Lỗi đọc Excel/CSV nội bộ:", err);
    return null;
  }
}
