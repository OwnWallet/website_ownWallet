import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nợ",
};

export default function DebtsPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">🤝 Nợ</h1>
      <div className="card">
        <p className="text-muted">— Sẽ được phát triển ở Phase tiếp theo —</p>
      </div>
    </div>
  );
}
