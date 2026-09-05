import type { Metadata } from "next";
import ImportUploadClient from "./ImportUploadClient";

export const metadata: Metadata = {
  title: "AI Import — wnWallet",
  description:
    "Upload sao kê ngân hàng PDF hoặc bảng Excel/CSV để AI tự động phân tích và nhập giao dịch vào wnWallet.",
};

export default function ImportPage() {
  return (
    <div className="animate-fade-in">
      <div className="import-page-header">
        <h1 className="text-2xl font-bold">🤖 AI Import Giao Dịch</h1>
        <p className="text-muted mt-1">
          Tự động trích xuất giao dịch từ sao kê ngân hàng hoặc bảng tính
        </p>
      </div>

      <ImportUploadClient />
    </div>
  );
}
