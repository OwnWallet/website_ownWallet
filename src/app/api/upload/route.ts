import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

/**
 * SVG bị loại khỏi danh sách vì có thể chứa script XSS khi được phục vụ inline.
 * Danh sách này chỉ cho phép các định dạng raster an toàn.
 */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

/** Tiêu đề bảo mật chung cho mọi response của route này */
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Content-Security-Policy", "default-src 'none'");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Định dạng request không hợp lệ" },
          { status: 400 }
        )
      );
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Không tìm thấy file ảnh đính kèm" },
          { status: 400 }
        )
      );
    }

    // Kiểm tra MIME type một cách chặt chẽ — SVG bị từ chối ngay cả khi
    // Content-Type bắt đầu bằng "image/" vì SVG có thể chứa JS/XSS.
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Chỉ hỗ trợ file hình ảnh (JPG, PNG, WEBP, GIF, HEIC). SVG không được phép." },
          { status: 400 }
        )
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Kích thước ảnh tối đa là 15MB" },
          { status: 400 }
        )
      );
    }

    // Serverless-safe: encode as Base64 data URL to avoid read-only filesystem errors (/var/task) on Vercel
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "image/jpeg";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return withSecurityHeaders(
      NextResponse.json({
        success: true,
        url: dataUrl,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi tải ảnh lên";
    return withSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}
