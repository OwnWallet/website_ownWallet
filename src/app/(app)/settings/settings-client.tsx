"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  changePassword,
  updateProfile,
  createCategory,
  deleteCategory,
} from "@/actions/settings";
import {
  ChangePasswordSchema,
  UpdateProfileSchema,
  CreateCategorySchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
  type CreateCategoryInput,
} from "@/schemas/settings";
import { CATEGORY_TYPE_COLORS, CATEGORY_TYPE_LABELS } from "@/lib/constants";
import {
  User,
  KeyRound,
  FolderPlus,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Shield,
  Clock,
  Sparkles,
} from "lucide-react";

interface Props {
  user: {
    name: string | null;
    email: string;
    timezone: string;
    createdAt: Date;
  };
  categories: {
    id: string;
    name: string;
    type: "EXPENSE" | "INCOME" | "INVEST" | "DEBT" | "SAVINGS";
    color: string;
    icon: string | null;
    isDefault: boolean;
  }[];
}

export function SettingsClient({ user, categories }: Props) {
  // Profile Form
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    formState: { isSubmitting: isSubmittingProfile },
  } = useForm<UpdateProfileInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(UpdateProfileSchema) as any,
    defaultValues: {
      name: user.name || "",
      timezone: user.timezone || "Asia/Ho_Chi_Minh",
    },
  });

  // Password Form
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const {
    register: regPass,
    handleSubmit: handlePass,
    reset: resetPass,
    formState: { errors: passErrors, isSubmitting: isSubmittingPass },
  } = useForm<ChangePasswordInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ChangePasswordSchema) as any,
  });

  // Category Form
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySuccess, setCategorySuccess] = useState(false);

  const {
    register: regCat,
    handleSubmit: handleCat,
    reset: resetCat,
    formState: { errors: catErrors, isSubmitting: isSubmittingCat },
  } = useForm<CreateCategoryInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(CreateCategorySchema) as any,
    defaultValues: {
      name: "",
      type: "EXPENSE",
      color: "#ea580c",
      icon: "🍜",
    },
  });

  async function onUpdateProfile(data: UpdateProfileInput) {
    setProfileError(null);
    setProfileSuccess(false);
    const fd = new FormData();
    fd.append("name", data.name);
    fd.append("timezone", data.timezone);

    const res = await updateProfile(fd);
    if (res?.error) {
      setProfileError("Không thể cập nhật thông tin.");
    } else {
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    }
  }

  async function onChangePassword(data: ChangePasswordInput) {
    setPasswordError(null);
    setPasswordSuccess(false);
    const fd = new FormData();
    fd.append("oldPassword", data.oldPassword);
    fd.append("newPassword", data.newPassword);
    fd.append("confirmPassword", data.confirmPassword);

    const res = await changePassword(fd);
    if (res?.error) {
      if (typeof res.error === "object" && "oldPassword" in res.error) {
        setPasswordError((res.error as any).oldPassword[0]);
      } else {
        setPasswordError("Đổi mật khẩu thất bại. Vui lòng kiểm tra lại.");
      }
    } else {
      setPasswordSuccess(true);
      resetPass();
      setTimeout(() => {
        setPasswordSuccess(false);
        setPasswordOpen(false);
      }, 2000);
    }
  }

  async function onCreateCategory(data: CreateCategoryInput) {
    setCategoryError(null);
    setCategorySuccess(false);
    const fd = new FormData();
    fd.append("name", data.name);
    fd.append("type", data.type);
    fd.append("color", data.color);
    fd.append("icon", data.icon);

    const res = await createCategory(fd);
    if (res?.error) {
      if (typeof res.error === "object" && "name" in res.error) {
        setCategoryError((res.error as any).name[0]);
      } else {
        setCategoryError("Không thể tạo danh mục");
      }
    } else {
      setCategorySuccess(true);
      resetCat();
      setTimeout(() => {
        setCategorySuccess(false);
        setCategoryOpen(false);
      }, 1500);
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (confirm(`Bạn có chắc muốn xóa danh mục "${name}"?`)) {
      const res = await deleteCategory(id);
      if (res?.error) {
        alert(res.error);
      }
    }
  }

  // Group categories by type
  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.type]) acc[cat.type] = [];
    acc[cat.type].push(cat);
    return acc;
  }, {} as Record<string, typeof categories>);

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* ── 1. User Profile ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <User size={18} className="text-primary" />
          <h2 className="text-lg font-bold">Thông tin cá nhân</h2>
        </div>

        <div className="card space-y-4">
          <form onSubmit={handleProfile(onUpdateProfile)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Email đăng nhập</label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm text-muted opacity-80 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Tên hiển thị</label>
                <input
                  {...regProfile("name")}
                  type="text"
                  placeholder="Tên của bạn..."
                  className="w-full bg-elevated border border-border-strong rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  <Clock size={12} className="inline mr-1" />
                  Múi giờ
                </label>
                <select
                  {...regProfile("timezone")}
                  className="w-full bg-elevated border border-border-strong rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                >
                  <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</option>
                  <option value="UTC">UTC (GMT+0)</option>
                  <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                </select>
              </div>
            </div>

            {profileError && (
              <p className="text-xs text-danger flex items-center gap-1">
                <AlertCircle size={14} /> {profileError}
              </p>
            )}

            {profileSuccess && (
              <p className="text-xs text-income flex items-center gap-1">
                <Check size={14} /> Đã lưu thông tin thành công!
              </p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmittingProfile}
                className="btn-primary py-2 px-5 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingProfile && <Loader2 size={14} className="animate-spin" />}
                Lưu thông tin
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── 2. Security & Password ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-primary" />
          <h2 className="text-lg font-bold">Bảo mật & Mật khẩu</h2>
        </div>

        <div className="card space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-foreground">Đổi mật khẩu tài khoản</p>
              <p className="text-xs text-muted mt-0.5">Khuyến nghị dùng mật khẩu dài ít nhất 8 ký tự</p>
            </div>
            <button
              onClick={() => setPasswordOpen(!passwordOpen)}
              className="btn-secondary py-1.5 px-4 text-xs font-semibold cursor-pointer"
            >
              {passwordOpen ? "Đóng form" : "Đổi mật khẩu"}
            </button>
          </div>

          {passwordOpen && (
            <form
              onSubmit={handlePass(onChangePassword)}
              className="pt-4 border-t border-border-strong space-y-3 animate-fade-in"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Mật khẩu hiện tại *</label>
                  <input
                    {...regPass("oldPassword")}
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-elevated border border-border-strong rounded-lg px-3 py-2 text-xs outline-none focus:border-primary text-foreground"
                  />
                  {passErrors.oldPassword && (
                    <p className="text-[11px] text-danger mt-1">{passErrors.oldPassword.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Mật khẩu mới *</label>
                  <input
                    {...regPass("newPassword")}
                    type="password"
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full bg-elevated border border-border-strong rounded-lg px-3 py-2 text-xs outline-none focus:border-primary text-foreground"
                  />
                  {passErrors.newPassword && (
                    <p className="text-[11px] text-danger mt-1">{passErrors.newPassword.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Xác nhận mật khẩu mới *</label>
                  <input
                    {...regPass("confirmPassword")}
                    type="password"
                    placeholder="Nhập lại mật khẩu"
                    className="w-full bg-elevated border border-border-strong rounded-lg px-3 py-2 text-xs outline-none focus:border-primary text-foreground"
                  />
                  {passErrors.confirmPassword && (
                    <p className="text-[11px] text-danger mt-1">{passErrors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              {passwordError && (
                <p className="text-xs text-danger flex items-center gap-1">
                  <AlertCircle size={14} /> {passwordError}
                </p>
              )}

              {passwordSuccess && (
                <p className="text-xs text-income flex items-center gap-1">
                  <Check size={14} /> Đổi mật khẩu thành công!
                </p>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingPass}
                  className="btn-primary py-2 px-5 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingPass && <Loader2 size={14} className="animate-spin" />}
                  Cập nhật mật khẩu
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ── 3. Categories Management ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus size={18} className="text-primary" />
            <h2 className="text-lg font-bold">Danh mục tài chính</h2>
          </div>
          <button
            onClick={() => setCategoryOpen(!categoryOpen)}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus size={14} />
            <span>{categoryOpen ? "Đóng" : "+ Thêm danh mục mới"}</span>
          </button>
        </div>

        {/* Add Category Form */}
        {categoryOpen && (
          <div className="card bg-elevated border-border-strong animate-fade-in p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Tạo danh mục tùy chỉnh</h3>
            <form onSubmit={handleCat(onCreateCategory)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted mb-1">Tên danh mục *</label>
                  <input
                    {...regCat("name")}
                    type="text"
                    placeholder="VD: Nuôi thú cưng, Cafe..."
                    className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-xs outline-none focus:border-primary text-foreground"
                  />
                  {catErrors.name && (
                    <p className="text-[11px] text-danger mt-1">{catErrors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Loại danh mục *</label>
                  <select
                    {...regCat("type")}
                    className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-xs outline-none focus:border-primary text-foreground"
                  >
                    <option value="EXPENSE">Chi tiêu (EXPENSE)</option>
                    <option value="INCOME">Thu nhập (INCOME)</option>
                    <option value="INVEST">Đầu tư (INVEST)</option>
                    <option value="DEBT">Nợ (DEBT)</option>
                    <option value="SAVINGS">Tiết kiệm (SAVINGS)</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-muted mb-1">Icon / Emoji</label>
                    <input
                      {...regCat("icon")}
                      type="text"
                      placeholder="🐱"
                      className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-xs outline-none focus:border-primary text-foreground text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Màu sắc</label>
                    <input
                      {...regCat("color")}
                      type="color"
                      className="w-10 h-9 p-0.5 bg-background border border-border-strong rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {categoryError && (
                <p className="text-xs text-danger flex items-center gap-1">
                  <AlertCircle size={14} /> {categoryError}
                </p>
              )}

              {categorySuccess && (
                <p className="text-xs text-income flex items-center gap-1">
                  <Check size={14} /> Đã thêm danh mục thành công!
                </p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmittingCat}
                  className="btn-primary py-2 px-5 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingCat && <Loader2 size={14} className="animate-spin" />}
                  Lưu danh mục
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Categories List by Type */}
        <div className="card space-y-6">
          {Object.entries(groupedCategories).map(([type, cats]) => (
            <div key={type} className="space-y-3">
              <h3
                className="text-xs font-bold uppercase tracking-wider pb-1 border-b border-border inline-block"
                style={{ color: CATEGORY_TYPE_COLORS[type as keyof typeof CATEGORY_TYPE_COLORS] }}
              >
                {CATEGORY_TYPE_LABELS[type as keyof typeof CATEGORY_TYPE_LABELS]} ({cats.length})
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {cats.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-2 bg-elevated border border-border-strong px-3 py-1.5 rounded-xl text-xs group hover:border-border transition-colors"
                  >
                    <span className="text-base">{cat.icon || "📁"}</span>
                    <span className="font-semibold text-foreground">{cat.name}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {!cat.isDefault && (
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        title="Xóa danh mục tùy chỉnh"
                        className="ml-1 text-muted hover:text-danger p-0.5 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. System Info ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          <h2 className="text-lg font-bold">Hệ thống wnWallet</h2>
        </div>

        <div className="card text-xs space-y-2.5 text-muted">
          <div className="flex justify-between py-1 border-b border-border">
            <span>Phiên bản ứng dụng</span>
            <span className="font-semibold text-foreground">v1.2.0 (Next.js 16 + React 19)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border">
            <span>Cơ sở dữ liệu & ORM</span>
            <span className="font-semibold text-foreground">PostgreSQL + Prisma 8 (Next)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border">
            <span>Xác thực & Bảo mật</span>
            <span className="font-semibold text-foreground">Auth.js v5 (bcryptjs)</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Chế độ giao diện</span>
            <span className="font-semibold text-primary flex items-center gap-1">
              <Sparkles size={12} /> Modern Crisp Orange Financial UI
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
