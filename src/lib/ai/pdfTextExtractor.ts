/**
 * pdfTextExtractor.ts
 * Trích xuất văn bản & tọa độ bảng (X, Y) từ file PDF (Digital PDF) thuần túy bằng built-in zlib của Node.js.
 * Hỗ trợ giải mã bảng font ToUnicode CMap (Identity-H 2-byte CID) của sao kê ngân hàng Việt Nam (TPBank, Vietcombank, Techcombank...).
 * Không cần bất kỳ thư viện ngoài nào (0 dependency), hoạt động hoàn hảo trên Serverless/Vercel/Node.js.
 */

import zlib from "zlib";

export interface PdfPositionedItem {
  page: number;
  x: number;
  y: number;
  text: string;
}

/**
 * Chuyển chuỗi literal PDF (nội dung bên trong dấu ngoặc đơn (...)) thành mảng byte (0..255)
 */
function unescapePdfLiteralBytes(raw: string): number[] {
  const bytes: number[] = [];
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === "n") {
        bytes.push(10);
        i += 2;
      } else if (next === "r") {
        bytes.push(13);
        i += 2;
      } else if (next === "t") {
        bytes.push(9);
        i += 2;
      } else if (next === "b") {
        bytes.push(8);
        i += 2;
      } else if (next === "f") {
        bytes.push(12);
        i += 2;
      } else if (next === "(" || next === ")" || next === "\\") {
        bytes.push(next.charCodeAt(0));
        i += 2;
      } else if (next === "\r" || next === "\n") {
        // Line continuation backslash at end of line
        if (next === "\r" && raw[i + 2] === "\n") {
          i += 3;
        } else {
          i += 2;
        }
      } else if (/[0-7]/.test(next)) {
        const octMatch = raw.slice(i + 1, i + 4).match(/^[0-7]{1,3}/);
        if (octMatch) {
          bytes.push(parseInt(octMatch[0], 8) & 0xff);
          i += 1 + octMatch[0].length;
        } else {
          bytes.push(next.charCodeAt(0));
          i += 2;
        }
      } else {
        bytes.push(next.charCodeAt(0));
        i += 2;
      }
    } else {
      bytes.push(ch.charCodeAt(0) & 0xff);
      i++;
    }
  }
  return bytes;
}

/**
 * Chuyển chuỗi Hex PDF (nội dung bên trong <...>) thành mảng byte (0..255)
 */
function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (!clean) return [];
  const padded = clean.length % 2 === 1 ? clean + "0" : clean;
  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    bytes.push(parseInt(padded.slice(i, i + 2), 16));
  }
  return bytes;
}

/**
 * Giải mã chuỗi Hex thành Unicode (dùng trong CMap destination)
 */
function decodeUnicodeHexToken(hex: string): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (!clean) return "";
  if (clean.length <= 4) {
    return String.fromCodePoint(parseInt(clean, 16));
  }
  // Nhiều UTF-16BE code units nối tiếp (ví dụ ligature hoặc ký tự tổ hợp)
  let out = "";
  for (let i = 0; i < clean.length; i += 4) {
    const unit = parseInt(clean.slice(i, i + 4), 16);
    if (!isNaN(unit)) {
      out += String.fromCharCode(unit);
    }
  }
  return out;
}

/**
 * Phân tích các khối begincmap ... endcmap để xây dựng bảng ánh xạ CID -> Unicode
 */
function parseCMapFromStreams(streams: string[]): Map<number, string> {
  const cmap = new Map<number, string>();

  for (const s of streams) {
    if (!s.includes("begincmap")) continue;

    // 1. beginbfchar ... endbfchar: <srcCode> <dstUnicode>
    const bfcharBlocks = s.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? [];
    for (const block of bfcharBlocks) {
      const pairRgx = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let m: RegExpExecArray | null;
      while ((m = pairRgx.exec(block)) !== null) {
        const cid = parseInt(m[1], 16);
        const uni = decodeUnicodeHexToken(m[2]);
        if (!isNaN(cid) && uni) {
          cmap.set(cid, uni);
        }
      }
    }

    // 2. beginbfrange ... endbfrange:
    // Dạng A: <start> <end> <dstStart>
    // Dạng B: <start> <end> [<dst1> <dst2> ...]
    const bfrangeBlocks = s.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? [];
    for (const block of bfrangeBlocks) {
      // Xử lý dạng mảng [<dst1> <dst2> ...] trước
      const arrayRangeRgx = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g;
      let am: RegExpExecArray | null;
      while ((am = arrayRangeRgx.exec(block)) !== null) {
        const start = parseInt(am[1], 16);
        const end = parseInt(am[2], 16);
        const tokens = am[3].match(/<([0-9a-fA-F]+)>/g) ?? [];
        for (let c = start, idx = 0; c <= end && idx < tokens.length; c++, idx++) {
          const hexVal = tokens[idx].slice(1, -1);
          cmap.set(c, decodeUnicodeHexToken(hexVal));
        }
      }

      // Xử lý dạng đơn <start> <end> <dstStart>
      const blockWithoutArrays = block.replace(arrayRangeRgx, "");
      const simpleRangeRgx = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let sm: RegExpExecArray | null;
      while ((sm = simpleRangeRgx.exec(blockWithoutArrays)) !== null) {
        const start = parseInt(sm[1], 16);
        const end = parseInt(sm[2], 16);
        const dstStart = parseInt(sm[3], 16);
        if (!isNaN(start) && !isNaN(end) && !isNaN(dstStart) && end >= start && end - start <= 2048) {
          for (let c = start; c <= end; c++) {
            cmap.set(c, String.fromCodePoint(dstStart + (c - start)));
          }
        }
      }
    }
  }

  return cmap;
}

/**
 * Giải mã mảng byte của một chuỗi PDF dựa trên bảng CMap (nếu là 2-byte CID) hoặc fallback UTF-16BE / Latin1
 */
function decodePdfBytesWithCMap(bytes: number[], cmap: Map<number, string>): string {
  if (bytes.length === 0) return "";

  // UTF-16BE có BOM FE FF
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let str = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      str += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return str;
  }

  // Nếu có bảng CMap và số byte chẵn, kiểm tra xem có phải 2-byte big-endian CID (Identity-H) không.
  // Trong font 2-byte CID, các byte chẵn (high byte của Glyph ID) luôn nằm trong vùng 0x00..0x1f.
  if (cmap.size > 0 && bytes.length >= 2 && bytes.length % 2 === 0) {
    let validHighBytes = 0;
    let hitCount = 0;
    const totalPairs = bytes.length / 2;
    let cidDecoded = "";

    for (let i = 0; i < bytes.length; i += 2) {
      const hi = bytes[i];
      const lo = bytes[i + 1];
      if (hi <= 0x1f) {
        validHighBytes++;
      }
      const cid = (hi << 8) | lo;
      const mapped = cmap.get(cid);
      if (mapped !== undefined) {
        cidDecoded += mapped;
        hitCount++;
      } else if (cid === 0) {
        // Bỏ qua padding null
      } else if (hi === 0 && lo >= 0x20 && lo <= 0x7e) {
        cidDecoded += String.fromCharCode(lo);
      }
    }

    if (
      totalPairs > 0 &&
      validHighBytes === totalPairs &&
      hitCount / totalPairs >= 0.5
    ) {
      return cidDecoded;
    }
  }

  // UTF-16BE không BOM (byte chẵn = 0x00)
  if (bytes.length >= 4 && bytes.length % 2 === 0 && bytes[0] === 0x00 && bytes[2] === 0x00) {
    let str = "";
    for (let i = 0; i < bytes.length; i += 2) {
      str += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return str;
  }

  return Buffer.from(bytes).toString("latin1");
}

/**
 * Tách và giải nén toàn bộ các stream trong file PDF
 */
function extractDecompressedStreams(buffer: Buffer): string[] {
  const streams: string[] = [];
  const streamStartKeyword = Buffer.from("stream");
  const streamEndKeyword = Buffer.from("endstream");

  let searchIndex = 0;

  while (searchIndex < buffer.length) {
    const startPos = buffer.indexOf(streamStartKeyword, searchIndex);
    if (startPos === -1) break;

    let dataStart = startPos + 6;
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) {
      dataStart += 2;
    } else if (buffer[dataStart] === 0x0a || buffer[dataStart] === 0x0d) {
      dataStart += 1;
    }

    const endPos = buffer.indexOf(streamEndKeyword, dataStart);
    if (endPos === -1) break;

    const dictSearchStart = Math.max(0, startPos - 250);
    const dictContext = buffer.slice(dictSearchStart, startPos).toString("latin1");
    const isFlate = /Filter\s*(?:\[[^\]]*\/FlateDecode|\/FlateDecode|\/Fl)/i.test(dictContext);

    // Cắt bỏ \r\n thừa sát trước endstream nếu có
    let sliceEnd = endPos;
    if (sliceEnd > dataStart && buffer[sliceEnd - 1] === 0x0a) sliceEnd--;
    if (sliceEnd > dataStart && buffer[sliceEnd - 1] === 0x0d) sliceEnd--;

    const streamBytes = buffer.slice(dataStart, sliceEnd);
    let decompressed: string | null = null;

    if (isFlate) {
      try {
        decompressed = zlib.inflateSync(streamBytes).toString("latin1");
      } catch {
        try {
          decompressed = zlib.inflateRawSync(streamBytes).toString("latin1");
        } catch {
          // Thử lại với endPos gốc nếu cắt \r\n làm thiếu byte
          try {
            decompressed = zlib.inflateSync(buffer.slice(dataStart, endPos)).toString("latin1");
          } catch {
            decompressed = null;
          }
        }
      }
    } else {
      decompressed = streamBytes.toString("latin1");
    }

    if (decompressed) {
      streams.push(decompressed);
    }

    searchIndex = endPos + 9;
  }

  return streams;
}

/**
 * Trích xuất các phần tử văn bản kèm tọa độ (page, x, y, text) từ một content stream
 */
function parsePositionedItemsFromStream(
  content: string,
  pageIndex: number,
  cmap: Map<number, string>
): PdfPositionedItem[] {
  const items: PdfPositionedItem[] = [];
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let btMatch: RegExpExecArray | null;

  while ((btMatch = btEtRegex.exec(content)) !== null) {
    const block = btMatch[1];
    const lines = block.split(/(?:\r?\n)+/);

    let currentX = 0;
    let currentY = 0;
    let currentText = "";

    const flushCurrent = () => {
      const cleaned = currentText.replace(/\s+/g, " ").trim();
      if (cleaned) {
        items.push({
          page: pageIndex,
          x: currentX,
          y: currentY,
          text: cleaned,
        });
      }
      currentText = "";
    };

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      // 1. Lệnh ma trận tọa độ: a b c d e f Tm
      const tmMatch = trimmed.match(
        /([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+Tm\b/
      );
      if (tmMatch) {
        if (currentText.trim()) flushCurrent();
        currentX = parseFloat(tmMatch[5]);
        currentY = parseFloat(tmMatch[6]);
      } else {
        // 2. Lệnh dịch chuyển tương đối: tx ty Td hoặc TD
        const tdMatch = trimmed.match(/^([\d\.\-]+)\s+([\d\.\-]+)\s+T[dD]\b/);
        if (tdMatch) {
          const dx = parseFloat(tdMatch[1]);
          const dy = parseFloat(tdMatch[2]);
          if (Math.abs(dy) > 0.5 && currentText.trim()) {
            flushCurrent();
          }
          currentX += dx;
          currentY += dy;
        }
      }

      // 3. Mảng TJ: [(...) -120 (...) <hex>] TJ
      const tjArrayMatch = trimmed.match(/\[([\s\S]*?)\]\s*TJ\b/);
      if (tjArrayMatch) {
        const inner = tjArrayMatch[1];
        const parts = inner.match(/\((?:[^()\\]|\\[\s\S])*?\)|<[0-9a-fA-F\s]+>/g);
        if (parts) {
          let chunk = "";
          for (const p of parts) {
            if (p.startsWith("(") && p.endsWith(")")) {
              chunk += decodePdfBytesWithCMap(unescapePdfLiteralBytes(p.slice(1, -1)), cmap);
            } else if (p.startsWith("<") && p.endsWith(">")) {
              chunk += decodePdfBytesWithCMap(hexToBytes(p.slice(1, -1)), cmap);
            }
          }
          if (chunk) {
            currentText += (currentText ? " " : "") + chunk;
          }
        }
        continue;
      }

      // 4. Chuỗi đơn (...) Tj
      const literalTjMatch = trimmed.match(/\(((?:[^()\\]|\\[\s\S])*)\)\s*Tj\b/);
      if (literalTjMatch) {
        const decoded = decodePdfBytesWithCMap(
          unescapePdfLiteralBytes(literalTjMatch[1]),
          cmap
        );
        if (decoded) {
          currentText += (currentText ? " " : "") + decoded;
        }
        continue;
      }

      // 5. Chuỗi Hex <...> Tj
      const hexTjMatch = trimmed.match(/<([0-9a-fA-F\s]+)>\s*Tj\b/);
      if (hexTjMatch) {
        const decoded = decodePdfBytesWithCMap(hexToBytes(hexTjMatch[1]), cmap);
        if (decoded) {
          currentText += (currentText ? " " : "") + decoded;
        }
        continue;
      }

      // 6. Xuống dòng T*
      if (/\bT\*/.test(trimmed) && currentText.trim()) {
        flushCurrent();
      }
    }

    if (currentText.trim()) {
      flushCurrent();
    }
  }

  return items;
}

/**
 * Lọc sạch nhiễu: điều khoản pháp lý, footer lặp lại, v.v.
 */
export function sanitizeBankStatementText(text: string): string {
  const noisyPatterns = [
    /Bảng sao kê được in tự động từ hệ thống/i,
    /Statement to be printed automatically/i,
    /không có chữ ký xác nhận và tính pháp lý/i,
    /without signature and legality/i,
    /Trang số:\s*\d+\s*\/\s*\d+/i,
    /Page\s*\d+\s*of\s*\d+/i,
  ];

  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[\-_=\*]{3,}$/.test(trimmed)) continue;
    if (noisyPatterns.some((pattern) => pattern.test(trimmed))) continue;

    cleaned.push(trimmed);
  }

  return cleaned.join("\n");
}

/**
 * Trích xuất danh sách tất cả phần tử văn bản có tọa độ (page, x, y, text) từ Buffer PDF.
 * Sắp xếp theo thứ tự trang tăng dần -> Y giảm dần (từ trên xuống dưới) -> X tăng dần (từ trái sang phải).
 */
export function extractPositionedItemsFromPdfBuffer(buffer: Buffer): PdfPositionedItem[] {
  try {
    const streams = extractDecompressedStreams(buffer);
    if (streams.length === 0) return [];

    const cmap = parseCMapFromStreams(streams);
    const allItems: PdfPositionedItem[] = [];
    let pageCounter = 0;

    for (const s of streams) {
      if (!s.includes("BT") || s.includes("begincmap")) continue;
      const pageItems = parsePositionedItemsFromStream(s, pageCounter + 1, cmap);
      if (pageItems.length > 0) {
        pageCounter++;
        // Sắp xếp các phần tử trong cùng trang theo Y giảm dần (sai số <= 3.5pt coi như cùng hàng), X tăng dần
        pageItems.sort((a, b) =>
          Math.abs(b.y - a.y) > 3.5 ? b.y - a.y : a.x - b.x
        );
        allItems.push(...pageItems);
      }
    }

    return allItems;
  } catch (err) {
    console.warn("[PDF Positioned Extractor] Lỗi khi bóc tách tọa độ PDF:", err);
    return [];
  }
}

/**
 * Hàm chính: Đọc Buffer của file PDF, thử trích xuất text layers (ghép các ô cùng hàng theo tọa độ Y).
 * Trả về chuỗi text sạch nếu thành công, hoặc null nếu PDF là ảnh scan không có text layer.
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string | null {
  try {
    const items = extractPositionedItemsFromPdfBuffer(buffer);
    if (items.length === 0) return null;

    // Nhóm các phần tử có cùng page và tọa độ Y xấp xỉ nhau (<= 3.5pt) thành từng dòng bảng
    const rows: { page: number; y: number; cells: PdfPositionedItem[] }[] = [];
    for (const item of items) {
      const lastRow = rows[rows.length - 1];
      if (lastRow && lastRow.page === item.page && Math.abs(lastRow.y - item.y) <= 3.5) {
        lastRow.cells.push(item);
      } else {
        rows.push({ page: item.page, y: item.y, cells: [item] });
      }
    }

    const rawLines = rows.map((r) => {
      r.cells.sort((a, b) => a.x - b.x);
      return r.cells.map((c) => c.text).join(" | ");
    });

    const fullRawText = rawLines.join("\n");
    if (fullRawText.length < 50) {
      return null;
    }

    const financialSignals = [
      /\b(?:giao dịch|sao kê|số dư|nợ|có|balance|debit|credit|tài khoản|account|VND|tiền)\b/i,
      /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/,
      /\d{1,3}(?:[,\.]\d{3})+/,
    ];

    const matchCount = financialSignals.filter((rgx) => rgx.test(fullRawText)).length;
    if (matchCount < 2) {
      return null;
    }

    return sanitizeBankStatementText(fullRawText);
  } catch (err) {
    console.warn("[PDF Text Extractor] Bỏ qua trích xuất text (sẽ dùng Vision):", err);
    return null;
  }
}
