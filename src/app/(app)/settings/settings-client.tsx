"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  changePassword,
  updateProfile,
  createCategory,
  deleteCategory,
  updateAiApiKey,
  testAiApiKey,
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
  Bot,
  Eye,
  EyeOff,
  ExternalLink,
  Cpu,
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
  initialAiConfig?: {
    isConfigured: boolean;
    maskedKey: string;
    model: string;
  };
}

export function SettingsClient({ user, categories, initialAiConfig }: Props) {
  // AI Config Form
  const [aiConfig, setAiConfig] = useState(
    initialAiConfig || { isConfigured: false, maskedKey: "", model: "gemini-3.6-flash" }
  );
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState(aiConfig.model || "gemini-3.6-flash");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [aiSaveSuccess, setAiSaveSuccess] = useState(false);
  const [aiSaveError, setAiSaveError] = useState<string | null>(null);

  async function handleSaveAiKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      setAiSaveError("Vui lòng nhập API Key.");
      return;
    }
    setIsSavingAi(true);
    setAiSaveError(null);
    setAiSaveSuccess(false);
    setAiTestResult(null);

    const fd = new FormData();
    fd.append("apiKey", apiKeyInput.trim());
    fd.append("model", modelInput);

    const res = await updateAiApiKey(fd);
    setIsSavingAi(false);

    if (res?.error) {
      setAiSaveError(res.error);
    } else {
      setAiSaveSuccess(true);
      const masked =
        apiKeyInput.trim().length > 12
          ? `${apiKeyInput.trim().slice(0, 6)}••••••••${apiKeyInput.trim().slice(-4)}`
          : "••••••••";
      setAiConfig({
        isConfigured: true,
        maskedKey: masked,
        model: modelInput,
      });
      setApiKeyInput("");
      setTimeout(() => setAiSaveSuccess(false), 3000);
    }
  }

  async function handleTestAiKey() {
    setIsTestingAi(true);
    setAiTestResult(null);
    setAiSaveError(null);

    const res = await testAiApiKey(apiKeyInput.trim() || undefined);
    setIsTestingAi(false);

    if (res?.success) {
      setAiTestResult({ success: true, message: res.message });
    } else {
      setAiTestResult({ success: false, message: res.error });
    }
  }
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

      {/* ── 3. AI Gemini Configuration ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-orange-600" />
            <h2 className="text-lg font-bold">Cấu hình AI (Google Gemini)</h2>
          </div>
          {aiConfig.isConfigured ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
              <Check size={12} /> Đang hoạt động ({aiConfig.maskedKey})
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5">
              <AlertCircle size={12} /> Chưa cấu hình API Key
            </span>
          )}
        </div>

        <div className="card space-y-4 p-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            API Key được sử dụng cho tính năng <strong>AI Import</strong> tự động trích xuất sao kê ngân hàng (PDF, Excel, hóa đơn hình ảnh) và phân loại thu chi thông minh.
          </p>

          <form onSubmit={handleSaveAiKey} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* API Key Input */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Gemini API Key <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      aiConfig.isConfigured
                        ? `Khóa hiện tại: ${aiConfig.maskedKey} (nhập để đổi mới)`
                        : "Dán mã API Key tại đây (VD: AIzaSy... hoặc AQ.Ab...)"
                    }
                    className="w-full bg-elevated border border-border-strong rounded-lg pl-3 pr-10 py-2 text-xs outline-none focus:border-primary text-foreground font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    title={showApiKey ? "Ẩn khóa" : "Hiện khóa"}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Model selection */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
                  <Cpu size={12} /> Model AI
                </label>
                <select
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full bg-elevated border border-border-strong rounded-lg px-2.5 py-2 text-xs outline-none focus:border-primary text-foreground cursor-pointer"
                >
                  <option value="gemini-3.6-flash">gemini-3.6-flash (Khuyến nghị 2026)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </select>
              </div>
            </div>

            {/* Hint & external link */}
            <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1 bg-slate-50 p-2.5 rounded-lg border border-border/80">
              <span>💡 Bạn có thể tạo hoặc lấy API Key miễn phí từ Google tại:</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-orange-600 font-semibold hover:underline inline-flex items-center gap-0.5 ml-1"
              >
                Google AI Studio <ExternalLink size={11} />
              </a>
            </div>

            {/* Test result message */}
            {aiTestResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  aiTestResult.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {aiTestResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
                <span>{aiTestResult.message}</span>
              </div>
            )}

            {/* Save error / success */}
            {aiSaveError && (
              <p className="text-xs text-danger flex items-center gap-1">
                <AlertCircle size={14} /> {aiSaveError}
              </p>
            )}
            {aiSaveSuccess && (
              <p className="text-xs text-income flex items-center gap-1">
                <Check size={14} /> Đã cập nhật và lưu API Key thành công!
              </p>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleTestAiKey}
                disabled={isTestingAi || (!apiKeyInput.trim() && !aiConfig.isConfigured)}
                className="btn-secondary py-2 px-4 text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isTestingAi && <Loader2 size={13} className="animate-spin" />}
                <span>{isTestingAi ? "Đang kiểm tra kết nối..." : "Kiểm tra kết nối AI"}</span>
              </button>

              <button
                type="submit"
                disabled={isSavingAi}
                className="btn-primary py-2 px-5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isSavingAi && <Loader2 size={13} className="animate-spin" />}
                <span>{isSavingAi ? "Đang lưu..." : "Lưu API Key"}</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── 4. Categories Management ── */}
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
          <h2 className="text-lg font-bold">Hệ thống OwnWallet</h2>
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
