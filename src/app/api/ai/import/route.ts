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
    const result = await parseDocument(buffer, file.name, categoryNames);

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
    const message =
      err instanceof Error ? err.message : "Lỗi không xác định từ AI.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
