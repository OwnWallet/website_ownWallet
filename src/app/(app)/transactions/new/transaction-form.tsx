"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Calendar, HandCoins, Tag } from "lucide-react";
import { toast } from "sonner";
import { createTransaction } from "@/actions/transactions";
import { TransactionSchema, type TransactionInput } from "@/schemas/transaction";
import { EvidenceUpload } from "@/components/ui/evidence-upload";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";
import { isDebtCategory, analyzeDebtTransaction } from "@/lib/debt-sync";
import { getCategoryTags } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface OpenDebtOption {
  id: string;
  person: string;
  amount: number;
  paidAmount: number;
  direction: "OWE" | "OWED";
  createdAt: string;
}

interface Props {
  categories: { id: string; name: string; type: string; color: string; icon: string | null }[];
  wallets?: { id: string; name: string; bankName?: string | null; isDefault?: boolean }[];
  openDebts?: OpenDebtOption[];
}

export function NewTransactionForm({ categories, wallets = [], openDebts = [] }: Props) {
  const router = useRouter();
  const [txType, setTxType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  // Gộp nợ là tùy chọn: mặc định tạo khoản nợ mới
  const [debtMode, setDebtMode] = useState<"NEW" | "MERGE">("NEW");
  const [targetDebtId, setTargetDebtId] = useState<string>("");

  const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<TransactionInput>({
    resolver: zodResolver(TransactionSchema) as any,
    defaultValues: {
      type: "EXPENSE",
      walletId: defaultWallet?.id || "",
      recordedAt: new Date(),
    },
  });

  const isLoading = isSubmitting || isNavigating;
  const currentAmount = useWatch({ control, name: "amount" });
  const selectedCatId = useWatch({ control, name: "categoryId" });
  const selectedCat = categories.find((c) => c.id === selectedCatId);
  const isDebt = isDebtCategory(selectedCat);
  const debtPersonVal = (useWatch({ control, name: "debtPerson" }) || "").trim();
  const syncToDebtVal = useWatch({ control, name: "syncToDebt" });
  const descriptionVal = useWatch({ control, name: "description" });

  const debtAnalysis = isDebt ? analyzeDebtTransaction(selectedCat, txType, descriptionVal || "") : null;
  // Khoản nợ chưa tất toán cùng chiều; ưu tiên người trùng tên lên đầu
  const candidateDebts = debtAnalysis
    ? openDebts
        .filter((d) => d.direction === debtAnalysis.direction)
        .sort((a, b) => {
          const p = debtPersonVal.toLowerCase();
          const am = a.person.trim().toLowerCase() === p ? 0 : 1;
          const bm = b.person.trim().toLowerCase() === p ? 0 : 1;
          if (am !== bm) return am - bm;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })
    : [];

  const filteredCats = categories.filter((c) => {
    if (c.type === txType) return true;
    if (c.type === "DEBT") {
      const lower = c.name.toLowerCase();
      if (txType === "INCOME") {
        return !lower.includes("cho vay") && !lower.includes("cho mượn") && !lower.includes("nợ phải thu");
      } else {
        return !lower.includes("đi vay") && !lower.includes("nợ phải trả");
      }
    }
    return false;
  });

  const selectedTag = useWatch({ control, name: "tag" }) || "";
  const availableTags = selectedCat ? getCategoryTags(selectedCat.name) : [];

  const handleSelectTag = (tag: string) => {
    if (selectedTag.trim().toLowerCase() === tag.trim().toLowerCase()) {
      setValue("tag", "", { shouldValidate: true });
    } else {
      setValue("tag", tag, { shouldValidate: true });
    }
  };

  async function onSubmit(data: TransactionInput) {
    if (isDebt && (data.syncToDebt ?? true) && debtMode === "MERGE" && !debtAnalysis?.isRepayment && !targetDebtId) {
      toast.warning("Vui lòng chọn khoản nợ cần gộp, hoặc chọn \"Tạo khoản nợ mới\"");
      return;
    }
    const formData = new FormData();
    formData.append("amount", String(data.amount));
    formData.append("type", data.type);
    if (data.walletId) formData.append("walletId", data.walletId);
    formData.append("categoryId", data.categoryId);
    if (data.debtPerson) formData.append("debtPerson", data.debtPerson);
    formData.append("syncToDebt", String(data.syncToDebt ?? true));
    if (isDebt) {
      formData.append("debtMode", debtMode);
      if (targetDebtId) formData.append("targetDebtId", targetDebtId);
    }
    if (data.tag) {
      formData.append("tag", data.tag);
    }
    if (data.description || data.note) {
      formData.append("note", (data.description || data.note)!);
      formData.append("description", (data.description || data.note)!);
    }
    if (evidenceUrl) {
      formData.append("evidenceUrl", evidenceUrl);
    }
    formData.append("recordedAt", data.recordedAt.toISOString());
    const result = await createTransaction(formData);
    if (result?.success) {
      toast.success("Đã ghi nhận giao dịch thành công");
      setIsNavigating(true);
      router.push("/transactions");
    } else if ((result as any)?.error) {
      const errObj = (result as any).error;
      const msg =
        typeof errObj === "string"
          ? errObj
          : Object.values(errObj).flat()[0] || "Không thể lưu giao dịch";
      toast.error(String(msg));
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#090d16",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
    marginBottom: "6px",
  };

  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <div style={{ maxWidth: "560px" }} className="animate-fade-in mx-auto">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--foreground-muted)",
            padding: "6px",
            borderRadius: "6px",
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: "20px", fontWeight: 700 }}>Thêm giao dịch</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div
          style={{
            backgroundColor: "var(--background-card)",
            border: "1px solid var(--border-strong)",
            borderRadius: "12px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* Type toggle */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--foreground-muted)",
                marginBottom: "8px",
              }}
            >
              Loại giao dịch
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {(["EXPENSE", "INCOME"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setTxType(type);
                    setValue("type", type);
                    setValue("categoryId", "");
                  }}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    border: `2px solid ${
                      txType === type
                        ? type === "INCOME"
                          ? "var(--color-income)"
                          : "var(--color-expense)"
                        : "var(--border-strong)"
                    }`,
                    backgroundColor:
                      txType === type
                        ? type === "INCOME"
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(239,68,68,0.12)"
                        : "transparent",
                    color:
                      txType === type
                        ? type === "INCOME"
                          ? "var(--color-income)"
                          : "var(--color-expense)"
                        : "var(--foreground-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {type === "INCOME" ? "💰 Thu nhập" : "💸 Chi tiêu"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--foreground-muted)",
                marginBottom: "6px",
              }}
            >
              Số tiền (₫) *
            </label>
            <SmartCurrencyInput
              value={currentAmount ?? ""}
              onChangeValue={(val) => setValue("amount", val, { shouldValidate: true })}
              placeholder="0"
              showQuickButtons
              showWordsPreview
              style={{
                ...inputStyle,
                fontSize: "22px",
                fontWeight: 700,
                borderColor: errors.amount ? "var(--color-danger)" : "var(--border-strong)",
              }}
            />
            {errors.amount && (
              <p style={{ fontSize: "12px", color: "var(--color-danger)", marginTop: "3px" }}>
                {errors.amount.message}
              </p>
            )}
          </div>

          {/* Wallet if available */}
          {wallets.length > 0 && (
            <div>
              <label style={labelStyle}>
                Ví tiền
              </label>
              <select
                {...register("walletId")}
                style={{
                  ...inputStyle,
                  borderColor: errors.walletId ? "var(--color-danger)" : "#cbd5e1",
                }}
              >
                <option value="" style={{ color: "#64748b" }}>-- Không gắn ví (Tiền ngoài sổ) --</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.bankName === "CASH" ? "💵" : "💳"} {w.name}{w.isDefault ? " (Mặc định)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category */}
          <div>
            <label style={labelStyle}>
              Danh mục *
            </label>
            <select
              {...register("categoryId")}
              style={{
                ...inputStyle,
                color: selectedCatId ? "#090d16" : "#64748b",
                fontWeight: selectedCatId ? 600 : 400,
                borderColor: errors.categoryId ? "var(--color-danger)" : "#cbd5e1",
              }}
            >
              <option value="" style={{ color: "#64748b" }}>-- Chọn danh mục --</option>
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p style={{ fontSize: "12px", color: "var(--color-danger)", marginTop: "3px" }}>
                {errors.categoryId.message}
              </p>
            )}
          </div>

          {/* Trường thông tin đối tác / người sở hữu khi chọn danh mục Vay / Cho vay */}
          {isDebt && (
            <div
              className="p-4 rounded-xl border space-y-3 animate-fade-in"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-debt, #f59e0b) 8%, var(--background-card))",
                borderColor: "color-mix(in srgb, var(--color-debt, #f59e0b) 30%, transparent)",
              }}
            >
              <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                  <HandCoins size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    Thông tin liên kết Sổ nợ
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Ghi nhận đối tác để đối chiếu hoặc tự động đồng bộ vào tab Sổ nợ
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Người sở hữu / Đối tác (Người vay hoặc cho vay) *
                </label>
                <input
                  type="text"
                  {...register("debtPerson")}
                  required={isDebt}
                  placeholder="VD: Nguyễn Văn A, Anh Tuấn..."
                  style={{
                    ...inputStyle,
                    borderColor: errors.debtPerson ? "var(--color-danger)" : "var(--border-strong)",
                  }}
                />
                {errors.debtPerson && (
                  <p style={{ fontSize: "12px", color: "var(--color-danger)", marginTop: "3px" }}>
                    {errors.debtPerson.message}
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  {...register("syncToDebt")}
                  defaultChecked={true}
                  className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-foreground block">
                    Tự động đồng bộ ngay vào Sổ nợ
                  </span>
                  <span className="text-[11px] text-muted-foreground block leading-tight">
                    Ghi theo đúng ngày giao dịch. Bạn chọn tạo khoản nợ mới hoặc gộp vào khoản nợ cũ bên dưới.
                  </span>
                </div>
              </label>

              {(syncToDebtVal ?? true) !== false && debtAnalysis && (
                debtAnalysis.isRepayment ? (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-foreground">
                      Ghi nhận trả nợ vào khoản
                    </label>
                    <select
                      value={targetDebtId}
                      onChange={(e) => setTargetDebtId(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Tự động: khoản chưa trả cũ nhất của người này</option>
                      {candidateDebts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.person} · {formatDate(d.createdAt)} · còn {formatCurrency(d.amount - d.paidAmount)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {(["NEW", "MERGE"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setDebtMode(mode);
                            if (mode === "NEW") setTargetDebtId("");
                          }}
                          className={`text-xs font-semibold rounded-lg border px-2 py-2 cursor-pointer transition-colors ${
                            debtMode === mode
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          {mode === "NEW" ? "🆕 Tạo khoản nợ mới" : "➕ Gộp vào khoản nợ cũ"}
                        </button>
                      ))}
                    </div>
                    {debtMode === "MERGE" && (
                      candidateDebts.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Chưa có khoản nợ nào đang mở cùng chiều để gộp — giao dịch sẽ cần tạo khoản nợ mới.
                        </p>
                      ) : (
                        <>
                          <select
                            value={targetDebtId}
                            onChange={(e) => setTargetDebtId(e.target.value)}
                            style={inputStyle}
                          >
                            <option value="">-- Chọn khoản nợ cần gộp --</option>
                            {candidateDebts.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.person} · {formatDate(d.createdAt)} · nợ {formatCurrency(d.amount)} (còn {formatCurrency(d.amount - d.paidAmount)})
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            Số tiền sẽ được cộng vào khoản đã chọn và lưu thành một dòng lịch sử trong khoản nợ đó.
                          </p>
                        </>
                      )
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Date/Time */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--foreground-muted)",
                marginBottom: "6px",
              }}
            >
              <Calendar size={13} style={{ display: "inline", marginRight: "4px" }} />
              Thời điểm giao dịch *
            </label>
            <input
              type="datetime-local"
              defaultValue={localNow}
              onChange={(e) => setValue("recordedAt", new Date(e.target.value))}
              style={{ ...inputStyle }}
            />
          </div>

          {/* Tag chi tiết (Tách riêng khỏi Mô tả) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--foreground-muted)",
                }}
              >
                <Tag size={13} style={{ display: "inline", marginRight: "4px" }} />
                Tag chi tiết (Tùy chọn)
              </label>
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => setValue("tag", "")}
                  className="text-[11px] text-danger hover:underline cursor-pointer"
                >
                  ✕ Bỏ chọn tag
                </button>
              )}
            </div>

            {/* Quick Tag Chips */}
            {availableTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTag.trim().toLowerCase() === tag.trim().toLowerCase();
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-all duration-150 flex items-center gap-1 ${
                        isSelected
                          ? "bg-primary text-white border-primary shadow-xs"
                          : "bg-card text-foreground hover:bg-muted/70 hover:border-slate-400 border-border"
                      }`}
                    >
                      <span>#{tag}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <input
              {...register("tag")}
              placeholder="Chọn tag gợi ý ở trên hoặc tự nhập tag..."
              style={inputStyle}
            />
          </div>

          {/* Ghi chú / Mô tả (Độc lập 100%) */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--foreground-muted)",
                marginBottom: "6px",
              }}
            >
              Ghi chú / Diễn giải thêm (Tùy chọn)
            </label>
            <input
              {...register("description")}
              placeholder="VD: Ăn trưa với đồng nghiệp, Mua tại cửa hàng..."
              style={inputStyle}
            />
          </div>

          {/* Evidence Photo */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--foreground-muted)",
                marginBottom: "6px",
              }}
            >
              Ảnh bằng chứng / Hóa đơn (Tùy chọn)
            </label>
            <EvidenceUpload
              value={evidenceUrl}
              onChange={(url) => {
                setEvidenceUrl(url);
                setValue("evidenceUrl", url);
              }}
              disabled={isSubmitting}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, var(--brand), var(--brand-dark))",
              color: "white",
              fontSize: "14px",
              fontWeight: 600,
              border: "none",
              cursor: isLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              opacity: isLoading ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? (isNavigating ? "Đang chuyển trang..." : "Đang lưu...") : "Lưu giao dịch"}
          </button>
        </div>
      </form>
    </div>
  );
}
