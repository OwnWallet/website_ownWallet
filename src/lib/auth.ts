import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { LoginSchema } from "@/schemas/auth";
import { DEFAULT_CATEGORIES } from "@/lib/constants";

/**
 * Kiểm tra xem email có nằm trong danh sách Whitelist cho phép hay không
 */
export function isEmailAllowed(email: string): boolean {
  const allowedEnv = process.env.ALLOWED_EMAILS;
  if (!allowedEnv || !allowedEnv.trim()) {
    return true; // Nếu không cấu hình ALLOWED_EMAILS thì cho phép tất cả
  }
  const allowedList = allowedEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowedList.length === 0) return true;
  return allowedList.includes(email.trim().toLowerCase());
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate input với Zod trước
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Kiểm tra whitelist
        if (!isEmailAllowed(email)) {
          return null;
        }

        const user = await db.orm.public.User
          .select("id", "email", "name", "password")
          .where({ email })
          .first();

        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      // ── Kiểm tra Whitelist ──
      if (!isEmailAllowed(email)) {
        console.warn(`[AUTH] Access denied for email not in whitelist: ${email}`);
        return false;
      }

      // ── Nếu đăng nhập bằng Google OAuth ──
      if (account?.provider === "google") {
        let dbUser = await db.orm.public.User.where({ email }).first();

        // Nếu người dùng chưa tồn tại trong DB, tự động tạo tài khoản mới + seed danh mục mặc định
        if (!dbUser) {
          const randomPassword = await bcrypt.hash(crypto.randomUUID(), 12);
          const newUser = await db.transaction(async (tx: any) => {
            const created = await tx.orm.public.User.create({
              name: user.name || email.split("@")[0],
              email,
              password: randomPassword,
            });

            for (const cat of DEFAULT_CATEGORIES) {
              await tx.orm.public.Category.create({ ...cat, userId: created.id });
            }
            return created;
          });
          dbUser = newUser;
        }

        if (dbUser) {
          user.id = (dbUser as any).id;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      // Đảm bảo token.id luôn là CUID từ database
      if (!token.id && token.email) {
        const dbUser = await db.orm.public.User
          .select("id")
          .where({ email: token.email.toLowerCase() })
          .first();
        if (dbUser) {
          token.id = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
