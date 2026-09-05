import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = {
  title: "Cài đặt | wnWallet",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  try {
    const [user, categories] = await Promise.all([
      db.orm.public.User.where({ id: session.user.id }).first(),
      db.orm.public.Category
        .where({ userId: session.user.id })
        .orderBy((c) => c.name.asc())
        .all(),
    ]);

    if (!user) {
      return <div className="p-8 text-center text-muted">Không tìm thấy người dùng</div>;
    }

    return (
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Cài đặt</h1>
          <p className="text-muted text-sm mt-1">Quản lý tài khoản, danh mục chi tiêu và cấu hình hệ thống</p>
        </div>

        <SettingsClient user={user as any} categories={categories as any} />
      </div>
    );
  } catch (error) {
    console.error(error);
    return (
      <div className="card text-center text-danger py-12">
        <p>Đã xảy ra lỗi khi tải cài đặt.</p>
      </div>
    );
  }
}
