import React from "react";

/**
 * Hiển thị số tiền trên MỘT dòng, không bao giờ cắt hay ngắt giữa các chữ số.
 * Khi chuỗi dài (VD "-1.234.567.890,12 ₫") chữ tự thu nhỏ theo cỡ chữ của phần tử cha.
 */
export function FitAmount({ children, className }: { children: React.ReactNode; className?: string }) {
  const text = React.Children.toArray(children)
    .filter((c) => typeof c === "string" || typeof c === "number")
    .join("");
  const len = text.length;
  const fontSize = len > 20 ? "0.6em" : len > 17 ? "0.7em" : len > 14 ? "0.8em" : len > 12 ? "0.9em" : undefined;
  return (
    <span className={["whitespace-nowrap", className].filter(Boolean).join(" ")} style={fontSize ? { fontSize } : undefined}>
      {children}
    </span>
  );
}
