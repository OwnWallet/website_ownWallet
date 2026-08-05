import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ngân sách",
};

export default function BudgetPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">💼 Ngân sách</h1>
      <div className="card">
        <p className="text-muted">— Sẽ được phát triển ở Phase tiếp theo —</p>
      </div>
    </div>
  );
}
