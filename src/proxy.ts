import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes không cần đăng nhập
const PUBLIC_ROUTES = ["/login", "/register"];

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isPublic = PUBLIC_ROUTES.some((r) => nextUrl.pathname.startsWith(r));

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
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
