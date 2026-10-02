import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes không cần đăng nhập
const PUBLIC_ROUTES = ["/login", "/register"];

// Các phần mở rộng tĩnh trong public/ không cần qua middleware xác thực
const STATIC_FILE_REGEX = /\.(png|jpg|jpeg|gif|webp|svg|ico|json|txt|woff|woff2)$/i;

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const { pathname } = nextUrl;

  // Bỏ qua static assets
  if (STATIC_FILE_REGEX.test(pathname) || pathname.startsWith("/uploads/")) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // Chưa login + vào route bảo vệ → redirect login
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Đã login + vào trang auth → redirect dashboard
  if (session && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Áp dụng middleware cho tất cả routes ngoại trừ static files, api/auth
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|woff2?)).*)",
  ],
};
