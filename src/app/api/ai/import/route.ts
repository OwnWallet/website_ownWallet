import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseDocument } from "@/lib/ai/parseDocument";
import { reconcileTransactionsWithDb } from "@/lib/ai/reconcile";
import { db } from "@/lib/db";

export const runtime = "nodejs"; // cần nodejs runtime để đọc Buffer

// Giới hạn body size — Next.js mặc định 4MB, tăng lên 12MB
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
    const result = await parseDocument(buffer, file.name, categoryNames, requestedModel);

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
    });
  } catch (err: unknown) {
    let message =
      err instanceof Error ? err.message : "Lỗi không xác định từ AI.";

    if (
      message.includes("503") ||
      message.toLowerCase().includes("high demand") ||
      message.toLowerCase().includes("service unavailable")
    ) {
      message =
        "Máy chủ Google Gemini đang quá tải toàn cầu (Lỗi 503). Vui lòng thử lại sau giây lát hoặc đổi sang model khác (như gemini-3.7-flash, gemini-2.5-flash hoặc gemini-1.5-flash) trong Cài đặt.";
    } else if (
      message.includes("429") ||
      message.toLowerCase().includes("resource exhausted") ||
      message.toLowerCase().includes("quota")
    ) {
      message =
        "Tài khoản Google Gemini đã hết hạn ngạch yêu cầu trong ngày (Lỗi 429 Quota Exceeded). Vui lòng đợi Google làm mới hạn ngạch hoặc nâng cấp tài khoản.";
    }

    return NextResponse.json({ error: message }, { status: 422 });
  }
}
