import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "wnWallet — Quản lí chi tiêu cá nhân",
    template: "%s | wnWallet",
  },
  description:
    "Theo dõi thu chi, đầu tư, nợ và mục tiêu tài chính của bạn theo thời gian thực.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
