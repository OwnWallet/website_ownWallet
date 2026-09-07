import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeData } from "@/lib/utils";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";
import { Settings } from "lucide-react";

import { getAiConfig } from "@/actions/settings";



export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  try {
    const [user, categories, aiConfig] = await Promise.all([
      db.orm.public.User
        .select("id", "name", "email", "timezone", "createdAt")
        .where({ id: session.user.id })
        .first(),
      db.orm.public.Category
        .where({ userId: session.user.id })
        .orderBy((c) => c.name.asc())
        .all(),
      getAiConfig(),
    ]);

    if (!user) {
      return <div className="p-8 text-center text-muted">Không tìm thấy người dùng</div>;
    }

    const { password: _pw, ...safeUser } = user as any;

    return (
      <div className="space-y-6 animate-fade-in w-full">
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white shadow-sm">
              <Settings size={20} />
            </div>
            <div>
              <h1 className="page-header-title">Cài đặt</h1>
              <p className="page-header-subtitle">Quản lý tài khoản, danh mục chi tiêu và cấu hình hệ thống</p>
            </div>
          </div>
        </div>

        <SettingsClient
          user={serializeData(safeUser)}
          categories={serializeData(categories)}
          initialAiConfig={aiConfig}
        />
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
