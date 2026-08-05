import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giao dịch",
};

export default function TransactionsPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">↔️ Giao dịch</h1>
      <div className="card">
        <p className="text-muted">— Sẽ được phát triển ở Phase tiếp theo —</p>
      </div>
    </div>
  );
}
