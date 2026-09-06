"use client";

interface TransactionRowProps {
  children: React.ReactNode;
  isLast: boolean;
  borderColor: string;
}

export function TransactionRow({ children, isLast, borderColor }: TransactionRowProps) {
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
        padding: "14px 20px", alignItems: "center",
        borderBottom: !isLast ? `1px solid ${borderColor}` : "none",
        transition: "background-color 0.15s",
        cursor: "default",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-elevated)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {children}
    </div>
  );
}
