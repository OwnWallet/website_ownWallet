import type { Metadata } from "next";
import ImportUploadClient from "./ImportUploadClient";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeData } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = {
  description:
    "Upload sao kê ngân hàng PDF hoặc bảng Excel/CSV để AI tự động phân tích và nhập giao dịch vào OwnWallet.",
};

export default async function ImportPage() {
  const session = await auth();
  let wallets: any[] = [];
  if (session?.user?.id) {
    try {
      const rawWallets = await db.orm.public.Wallet
        .where((w) => w.userId.eq(session.user.id))
        .orderBy((w) => w.createdAt.asc())
        .all();
      wallets = serializeData(rawWallets);
    } catch (err) {
      console.error("Failed to load wallets for import:", err);
    }
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="page-header-title">AI Import Giao Dịch</h1>
              <p className="page-header-subtitle">
                Tự động trích xuất giao dịch từ sao kê ngân hàng hoặc bảng tính Excel/CSV
              </p>
            </div>
          </div>
        </div>
      </div>

      <ImportUploadClient wallets={wallets} />
    </div>
  );
}
