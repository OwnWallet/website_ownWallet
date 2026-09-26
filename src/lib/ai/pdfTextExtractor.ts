/**
 * pdfTextExtractor.ts
 * Trích xuất văn bản từ file PDF (Digital PDF) thuần túy bằng built-in zlib của Node.js.
 * Không cần bất kỳ thư viện ngoài nào (0 dependency), hoạt động hoàn hảo trên Serverless/Vercel/Node.js.
 * 
 * Nếu PDF là dạng ảnh scan (không có text layer) hoặc bị mã hóa phức tạp,
 * hàm sẽ trả về null để hệ thống tự động fallback sang Gemini Vision.
 */

import zlib from "zlib";

/**
 * Giải mã chuỗi PDF Literal escape dạng (abc\n\040)
 */
function decodePdfLiteralString(raw: string): string {
  let result = "";
  let i = 0;
  while (i < raw.length) {
    const char = raw[i];
    if (char === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === "n") {
        result += "\n";
        i += 2;
      } else if (next === "r") {
        result += "\r";
        i += 2;
      } else if (next === "t") {
        result += "\t";
        i += 2;
      } else if (next === "b") {
        result += "\b";
        i += 2;
      } else if (next === "f") {
        result += "\f";
        i += 2;
      } else if (next === "(" || next === ")" || next === "\\") {
        result += next;
        i += 2;
      } else if (/[0-7]/.test(next)) {
        // Octal escape \ooo (1-3 chữ số)
        const octMatch = raw.slice(i + 1, i + 4).match(/^[0-7]{1,3}/);
        if (octMatch) {
          const octVal = parseInt(octMatch[0], 8);
          result += String.fromCharCode(octVal);
          i += 1 + octMatch[0].length;
        } else {
          result += next;
          i += 2;
        }
      } else {
        result += next;
        i += 2;
      }
    } else {
      result += char;
      i++;
    }
  }
  return result;
}

/**
 * Giải mã chuỗi Hex dạng <00410042> hoặc <4142>
 */
function decodePdfHexString(hex: string): string {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, "");
  if (!cleanHex) return "";

  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.substring(i, i + 2).padEnd(2, "0"), 16);
    bytes.push(byte);
  }

  // UTF-16BE với BOM FE FF
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let str = "";
    for (let i = 2; i < bytes.length; i += 2) {
      str += String.fromCharCode((bytes[i] << 8) | (bytes[i + 1] ?? 0));
    }
    return str;
  }

  // UTF-16BE không BOM
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[2] === 0x00) {
    let str = "";
    for (let i = 0; i < bytes.length; i += 2) {
      str += String.fromCharCode((bytes[i] << 8) | (bytes[i + 1] ?? 0));
    }
    return str;
  }

  return Buffer.from(bytes).toString("latin1");
}

/**
 * Phân tích các khối text (BT ... ET) trong một stream đã giải nén
 */
function parseStreamContent(content: string): string[] {
  const lines: string[] = [];
  let currentLine = "";

  const btEtRegex = /BT[\s\S]*?ET/g;
  let btMatch: RegExpExecArray | null;

  while ((btMatch = btEtRegex.exec(content)) !== null) {
    const block = btMatch[0];
    const rawTokens = block.split(/(?:\r?\n)+/);

    for (const token of rawTokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;

      // 1. Array TJ: [(text1) 120 (text2)] TJ
      const tjArrayMatch = trimmed.match(/\[([\s\S]*?)\]\s*TJ/);
      if (tjArrayMatch) {
        const inner = tjArrayMatch[1];
        const parts = inner.match(/\((?:[^()\\]|\\.)*\)|<[0-9a-fA-F\s]+>/g);
        if (parts) {
          let linePart = "";
          for (const p of parts) {
            if (p.startsWith("(") && p.endsWith(")")) {
              linePart += decodePdfLiteralString(p.slice(1, -1));
            } else if (p.startsWith("<") && p.endsWith(">")) {
              linePart += decodePdfHexString(p.slice(1, -1));
            }
          }
          if (linePart) {
            currentLine += (currentLine ? " " : "") + linePart;
          }
        }
        continue;
      }

      // 2. Single Tj: (text) Tj
      const tjMatch = trimmed.match(/\(((?:[^()\\]|\\.)*)\)\s*Tj/);
      if (tjMatch) {
        const decoded = decodePdfLiteralString(tjMatch[1]);
        if (decoded) {
          currentLine += (currentLine ? " " : "") + decoded;
        }
        continue;
      }

      // 3. Hex Tj: <hex> Tj
      const hexTjMatch = trimmed.match(/<([0-9a-fA-F\s]+)>\s*Tj/);
      if (hexTjMatch) {
        const decoded = decodePdfHexString(hexTjMatch[1]);
        if (decoded) {
          currentLine += (currentLine ? " " : "") + decoded;
        }
        continue;
      }

      // 4. Các lệnh xuống dòng / ngắt đoạn
      if (/T\*|\bTd\b|\bTD\b|'|"/.test(trimmed)) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = "";
        }
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  }

  return lines;
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
    /Số dư đầu kỳ.*?Beginning balance/i,
    /Tổng phát sinh.*?Total amount incurred/i,
  ];

  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Bỏ qua dòng chỉ chứa dấu gạch ngang hoặc ký tự đặc biệt
    if (/^[\-_=\*]{3,}$/.test(trimmed)) continue;
    // Bỏ qua các disclaimer không cần thiết
    if (noisyPatterns.some((pattern) => pattern.test(trimmed))) continue;

    cleaned.push(trimmed);
  }

  return cleaned.join("\n");
}

/**
 * Hàm chính: Đọc Buffer của file PDF, thử trích xuất text layers.
 * Trả về chuỗi text sạch nếu thành công, hoặc null nếu không trích xuất được.
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string | null {
  try {
    const extractedLines: string[] = [];
    const streamStartKeyword = Buffer.from("stream");
    const streamEndKeyword = Buffer.from("endstream");

    let searchIndex = 0;

    while (searchIndex < buffer.length) {
      const startPos = buffer.indexOf(streamStartKeyword, searchIndex);
      if (startPos === -1) break;

      // Tìm vị trí bắt đầu dữ liệu (sau stream\r?\n)
      let dataStart = startPos + 6;
      if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) {
        dataStart += 2;
      } else if (buffer[dataStart] === 0x0a || buffer[dataStart] === 0x0d) {
        dataStart += 1;
      }

      const endPos = buffer.indexOf(streamEndKeyword, dataStart);
      if (endPos === -1) break;

      // Kiểm tra dictionary trước stream xem có /FlateDecode không
      const dictSearchStart = Math.max(0, startPos - 250);
      const dictContext = buffer.slice(dictSearchStart, startPos).toString("latin1");
      const isFlate = /Filter\s*(?:\[[^\]]*\/FlateDecode|\/FlateDecode|\/Fl)/i.test(dictContext);

      const streamBytes = buffer.slice(dataStart, endPos);

      let decompressed: string | null = null;
      if (isFlate) {
        try {
          decompressed = zlib.inflateSync(streamBytes).toString("latin1");
        } catch {
          try {
            decompressed = zlib.inflateRawSync(streamBytes).toString("latin1");
          } catch {
            decompressed = null;
          }
        }
      } else {
        // Stream không nén
        decompressed = streamBytes.toString("latin1");
      }

      if (decompressed && decompressed.includes("BT")) {
        const streamLines = parseStreamContent(decompressed);
        if (streamLines.length > 0) {
          extractedLines.push(...streamLines);
        }
      }

      searchIndex = endPos + 9;
    }

    if (extractedLines.length === 0) {
      return null;
    }

    const fullRawText = extractedLines.join("\n");

    // Kiểm tra độ tin cậy của dữ liệu trích xuất (độ dài & từ khóa tài chính)
    if (fullRawText.length < 50) {
      return null;
    }

    const financialSignals = [
      /\b(?:giao dịch|sao kê|số dư|nợ|có|balance|debit|credit|tài khoản|account|VND|tiền)\b/i,
      /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/, // Ngày tháng DD/MM/YYYY
      /\d{1,3}(?:,\d{3})+/, // Số tiền định dạng 1,000,000
    ];

    const matchCount = financialSignals.filter((rgx) => rgx.test(fullRawText)).length;
    if (matchCount < 2) {
      return null; // Không đủ tin cậy, chuyển cho Vision AI đọc
    }

    return sanitizeBankStatementText(fullRawText);
  } catch (err) {
    console.warn("[PDF Text Extractor] Bỏ qua trích xuất text (sẽ dùng Vision):", err);
    return null;
  }
}
