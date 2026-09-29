"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Calendar, HandCoins } from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import { TransactionSchema, type TransactionInput } from "@/schemas/transaction";
import { EvidenceUpload } from "@/components/ui/evidence-upload";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";
import { isDebtCategory } from "@/lib/debt-sync";

interface Props {
  categories: { id: string; name: string; type: string; color: string; icon: string | null }[];
  wallets?: { id: string; name: string; bankName?: string | null }[];
}

export function NewTransactionForm({ categories, wallets = [] }: Props) {
  const router = useRouter();
  const [txType, setTxType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<TransactionInput>({
    resolver: zodResolver(TransactionSchema) as any,
    defaultValues: {
      type: "EXPENSE",
      recordedAt: new Date(),
    },
  });

  const isLoading = isSubmitting || isNavigating;
  const currentAmount = watch("amount");
  const selectedCatId = watch("categoryId");
  const selectedCat = categories.find((c) => c.id === selectedCatId);
  const isDebt = isDebtCategory(selectedCat);

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

  async function onSubmit(data: TransactionInput) {
    const formData = new FormData();
    formData.append("amount", String(data.amount));
    formData.append("type", data.type);
    if (data.walletId) formData.append("walletId", data.walletId);
    formData.append("categoryId", data.categoryId);
    if (data.debtPerson) formData.append("debtPerson", data.debtPerson);
    formData.append("syncToDebt", String(data.syncToDebt ?? true));
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
      setIsNavigating(true);
      router.push("/transactions");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    backgroundColor: "var(--background-elevated)",
    border: "1px solid var(--border-strong)",
    color: "var(--foreground)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
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
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--foreground-muted)",
                  marginBottom: "6px",
                }}
              >
                Ví tiền
              </label>
              <select
                {...register("walletId")}
                style={{
                  ...inputStyle,
                  borderColor: errors.walletId ? "var(--color-danger)" : "var(--border-strong)",
                }}
              >
                <option value="">-- Mặc định --</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.bankName === "CASH" ? "💵" : "💳"} {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category */}
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
              Danh mục *
            </label>
            <select
              {...register("categoryId")}
              style={{
                ...inputStyle,
                borderColor: errors.categoryId ? "var(--color-danger)" : "var(--border-strong)",
              }}
            >
              <option value="">-- Chọn danh mục --</option>
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
                    Hệ thống sẽ đối chiếu: cộng dồn vào nợ cũ nếu người này đã có nợ, hoặc tạo nợ mới nếu chưa có.
                  </span>
                </div>
              </label>
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

          {/* Description */}
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
              Ghi chú / Mô tả
            </label>
            <input
              {...register("description")}
              placeholder="VD: Ăn trưa với đồng nghiệp..."
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
