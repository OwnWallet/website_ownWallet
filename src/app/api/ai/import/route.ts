import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseDocument } from "@/lib/ai/parseDocument";
import { reconcileTransactionsWithDb } from "@/lib/ai/reconcile";
import { db } from "@/lib/db";

export const runtime = "nodejs"; // cần nodejs runtime để đọc Buffer

// Mỗi lần gọi AI có timeout riêng (AI_CALL_TIMEOUT_MS) và tổng ≤ 45s để luôn trả kết quả trước 60s
export const maxDuration = 60; // giây

export async function POST(request: NextRequest) {
  // ── Auth ──
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // ── Parse multipart/form-data ──
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request không hợp lệ. Vui lòng gửi multipart/form-data." },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  const requestedModel = (formData.get("model") as string)?.trim() || undefined;

  if (!file) {
    return NextResponse.json(
      { error: "Không tìm thấy file trong request." },
      { status: 400 }
    );
  }

  // ── Đọc file thành Buffer ──
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ── Lấy danh sách category của user để inject vào prompt ──
  const categories = await db.orm.public.Category
    .select("name")
    .where({ userId })
    .all();
  const categoryNames = categories.map((c: any) => c.name);

  // ── Gọi AI ──
  try {
    if (request.signal.aborted) {
      return NextResponse.json(
        { error: "Đã dừng phân tích theo yêu cầu của người dùng." },
        { status: 499 }
      );
    }

    const result = await parseDocument(buffer, file.name, categoryNames, requestedModel);

    if (request.signal.aborted) {
      return NextResponse.json(
        { error: "Đã dừng phân tích theo yêu cầu của người dùng." },
        { status: 499 }
      );
    }

    // ── Đối chiếu với database để phát hiện trùng lặp ──
    const reconciledTransactions = await reconcileTransactionsWithDb(
      result.transactions,
      userId
    );

    const duplicateCount = reconciledTransactions.filter(
      (t) => t.duplicateInfo?.isDuplicate
    ).length;

    return NextResponse.json({
      success: true,
      transactions: reconciledTransactions,
      totalFound: result.totalFound,
      skipped: result.skipped,
      duplicateCount,
      modeUsed: result.modeUsed ?? "ai",
      fallbackReason: result.fallbackReason,
      detectedBank: result.detectedBank,
      detectedAccountNumber: result.detectedAccountNumber,
    });
  } catch (err: unknown) {
    // Thông báo lỗi đã được chuẩn hóa trong lib/ai/gemini.ts (timeout / 503 / 429 / API key / model)
    const message = err instanceof Error ? err.message : "Lỗi không xác định khi phân tích file.";
    console.error("[Import] Phân tích thất bại:", message);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
