"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Calendar } from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import { TransactionSchema, type TransactionInput } from "@/schemas/transaction";

interface Props {
  categories: { id: string; name: string; type: string; color: string; icon: string | null }[];
  wallets?: { id: string; name: string }[];
}

export function NewTransactionForm({ categories, wallets = [] }: Props) {
  const router = useRouter();
  const [txType, setTxType] = useState<"EXPENSE" | "INCOME">("EXPENSE");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<TransactionInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(TransactionSchema) as any,
    defaultValues: {
      type: "EXPENSE",
      recordedAt: new Date(),
    },
  });

  const filteredCats = categories.filter((c) =>
    ["EXPENSE", "INCOME"].includes(c.type) ? c.type === txType : false
  );

  async function onSubmit(data: TransactionInput) {
    const formData = new FormData();
    formData.append("amount", String(data.amount));
    formData.append("type", data.type);
    if (data.walletId) formData.append("walletId", data.walletId);
    formData.append("categoryId", data.categoryId);
    if (data.description || data.note) {
      formData.append("note", (data.description || data.note)!);
      formData.append("description", (data.description || data.note)!);
    }
    formData.append("recordedAt", data.recordedAt.toISOString());
    const result = await createTransaction(formData);
    if (result?.success) router.push("/transactions");
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
            <input
              {...register("amount")}
              type="number"
              min="1"
              placeholder="0"
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
                    💳 {w.name}
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

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, var(--brand), var(--brand-dark))",
              color: "white",
              fontSize: "14px",
              fontWeight: 600,
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              opacity: isSubmitting ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {isSubmitting ? "Đang lưu..." : "Lưu giao dịch"}
          </button>
        </div>
      </form>
    </div>
  );
}
