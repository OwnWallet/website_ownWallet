"use client";

interface TransactionRowProps {
  children: React.ReactNode;
  isLast: boolean;
  borderColor: string;
}

export function TransactionRow({ children, isLast, borderColor }: TransactionRowProps) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] px-3 sm:px-5 py-3 sm:py-3.5 items-center gap-2 sm:gap-4 transition-colors cursor-default hover:bg-slate-50/80"
      style={{
        borderBottom: !isLast ? `1px solid ${borderColor}` : "none",
      }}
    >
      {children}
    </div>
  );
}
