"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { cn, readVietnameseCurrency, roundToHundredth } from "@/lib/utils";

export interface SmartCurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue"> {
  /** Giá trị số (dành cho controlled component / react-hook-form) */
  value?: number | string;
  /** Giá trị mặc định ban đầu */
  defaultValue?: number | string;
  /** Callback khi giá trị số thay đổi */
  onChangeValue?: (value: number, rawString: string) => void;
  /** Tên trường cho native HTML form (FormData) */
  name?: string;
  /** Cho phép nhập số thập phân hay không (mặc định false: chỉ số nguyên VNĐ) */
  allowDecimals?: boolean;
  /** Có hiển thị các nút cộng nhanh số tiền (+10k, +50k, +100k, ...) không */
  showQuickButtons?: boolean;
  /** Có hiển thị văn bản đọc tiền bằng chữ tiếng Việt không */
  showWordsPreview?: boolean;
  /** Đơn vị tiền tệ hiển thị (mặc định: ₫) */
  currencySymbol?: string;
  /** ClassName bổ sung cho container ngoài */
  containerClassName?: string;
  /** Giá trị tối đa cho phép */
  maxAmount?: number;
}

/**
 * Định dạng chuỗi số với dấu chấm phân cách hàng nghìn vi-VN
 * @example formatNumberWithDots("1000000") → "1.000.000"
 */
function formatNumberWithDots(digitsStr: string, allowDecimals = false): string {
  if (!digitsStr) return "";

  if (!allowDecimals) {
    // Chỉ lấy số nguyên
    const clean = digitsStr.replace(/[^\d]/g, "");
    if (!clean) return "";
    // Bỏ số 0 vô nghĩa ở đầu trừ khi chỉ có 1 số 0
    const noLeadingZeros = clean.replace(/^0+(?=\d)/, "");
    return noLeadingZeros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Hỗ trợ số thập phân (dấu phẩy hoặc chấm)
  const normalized = digitsStr.replace(",", ".");
  const parts = normalized.split(".");
  const integerPart = parts[0].replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "") || "0";
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (parts.length > 1) {
    // Giới hạn tối đa 2 chữ số thập phân (số thập phân hàng trăm)
    const decimalPart = parts[1].replace(/[^\d]/g, "").slice(0, 2);
    return `${formattedInteger},${decimalPart}`;
  }

  return formattedInteger;
}

/**
 * Trích xuất giá trị số thực từ chuỗi định dạng
 */
function parseNumericValue(formattedStr: string, allowDecimals = false): number {
  if (!formattedStr) return 0;
  if (!allowDecimals) {
    const digits = formattedStr.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }
  const normalized = formattedStr.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : roundToHundredth(num);
}

export const SmartCurrencyInput = forwardRef<HTMLInputElement, SmartCurrencyInputProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onChangeValue,
      name,
      allowDecimals = false,
      showQuickButtons = false,
      showWordsPreview = false,
      currencySymbol = "₫",
      containerClassName,
      className,
      placeholder = "0",
      disabled,
      readOnly,
      maxAmount = 1_000_000_000_000, // 1 nghìn tỷ
      ...restProps
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current!);

    // Xác định giá trị ban đầu
    const initialNumeric =
      controlledValue !== undefined
        ? Number(controlledValue) || 0
        : defaultValue !== undefined
        ? Number(defaultValue) || 0
        : 0;

    const [rawValue, setRawValue] = useState<number>(initialNumeric);
    const [displayValue, setDisplayValue] = useState<string>(() =>
      initialNumeric > 0 ? formatNumberWithDots(String(initialNumeric), allowDecimals) : ""
    );

    // Đồng bộ khi controlledValue từ ngoài thay đổi
    useEffect(() => {
      if (controlledValue !== undefined) {
        const num = Number(controlledValue) || 0;
        setRawValue(num);
        setDisplayValue(num > 0 ? formatNumberWithDots(String(num), allowDecimals) : "");
      }
    }, [controlledValue, allowDecimals]);

    /**
     * Cập nhật giá trị và giữ vị trí con trỏ thông minh
     */
    const updateValueWithCaret = (newDisplayStr: string, originalCaretPos?: number) => {
      let numeric = parseNumericValue(newDisplayStr, allowDecimals);
      if (numeric > maxAmount) {
        numeric = maxAmount;
        newDisplayStr = formatNumberWithDots(String(maxAmount), allowDecimals);
      }

      setRawValue(numeric);
      setDisplayValue(newDisplayStr);

      if (onChangeValue) {
        onChangeValue(numeric, String(numeric));
      }

      // Giữ vị trí con trỏ sau khi format
      if (inputRef.current && originalCaretPos !== undefined) {
        // Đếm số chữ số đứng trước vị trí con trỏ
        const prevText = inputRef.current.value.slice(0, originalCaretPos);
        const digitCountBefore = prevText.replace(/[^\d]/g, "").length;

        requestAnimationFrame(() => {
          if (!inputRef.current) return;
          let currentDigits = 0;
          let newCaretPos = newDisplayStr.length;

          for (let i = 0; i < newDisplayStr.length; i++) {
            if (/\d/.test(newDisplayStr[i])) {
              currentDigits++;
            }
            if (currentDigits === digitCountBefore) {
              newCaretPos = i + 1;
              break;
            }
          }
          inputRef.current.setSelectionRange(newCaretPos, newCaretPos);
        });
      }
    };

    /**
     * BỘ LỌC KÝ TỰ: Chặn hoàn toàn các phím chữ cái, ký tự đặc biệt không phải số
     */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Cho phép các tổ hợp phím hệ thống: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z, etc.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Cho phép các phím điều hướng và thao tác cơ bản
      const allowedControlKeys = [
        "Backspace",
        "Delete",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "Tab",
        "Enter",
        "Escape",
      ];
      if (allowedControlKeys.includes(e.key)) return;

      // Cho phép phím phân cách thập phân nếu allowDecimals được bật
      if (allowDecimals && (e.key === "." || e.key === ",")) {
        if (!displayValue.includes(",") && !displayValue.includes(".")) {
          return;
        }
        e.preventDefault();
        return;
      }

      // CHỈ CHO PHÉP NHẬP SỐ (0-9). Chặn chữ cái và toàn bộ ký tự khác
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    };

    /**
     * Xử lý khi gõ hoặc thay đổi nội dung
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const caret = e.target.selectionStart ?? e.target.value.length;
      const formatted = formatNumberWithDots(e.target.value, allowDecimals);
      updateValueWithCaret(formatted, caret);
    };

    /**
     * Xử lý Paste: lọc chỉ giữ lại số và format
     */
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData("text");
      // Trích xuất chỉ số (và dấu phẩy/chấm nếu cho phép thập phân)
      const cleaned = allowDecimals
        ? pastedText.replace(/[^\d.,]/g, "")
        : pastedText.replace(/[^\d]/g, "");

      if (!cleaned) return;

      const formatted = formatNumberWithDots(cleaned, allowDecimals);
      updateValueWithCaret(formatted, formatted.length);
    };

    /**
     * Nút bấm cộng nhanh số tiền (+10k, +50k, +100k, ...)
     */
    const handleQuickAdd = (amountToAdd: number) => {
      if (disabled || readOnly) return;
      const nextVal = rawValue + amountToAdd;
      const clamped = Math.min(nextVal, maxAmount);
      const formatted = formatNumberWithDots(String(clamped), allowDecimals);
      updateValueWithCaret(formatted, formatted.length);
      inputRef.current?.focus();
    };

    const handleQuickClear = () => {
      if (disabled || readOnly) return;
      updateValueWithCaret("", 0);
      inputRef.current?.focus();
    };

    // Đọc tiền bằng chữ
    const wordsPreview = showWordsPreview && rawValue > 0 ? readVietnameseCurrency(rawValue) : "";

    return (
      <div className={cn("w-full space-y-1.5", containerClassName)}>
        {/* Hidden input để gửi FormData thuần số nguyên cho native HTML forms */}
        {name && <input type="hidden" name={name} value={rawValue > 0 ? rawValue : ""} />}

        {/* Ô nhập tiền trực quan có bộ lọc và format */}
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={displayValue}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
            onPaste={handlePaste}
            className={cn(
              "w-full rounded-lg border border-input bg-transparent px-3 py-2 pr-9 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className
            )}
            {...restProps}
          />
          {currencySymbol && (
            <span className="pointer-events-none absolute right-3 text-sm font-semibold text-muted-foreground select-none">
              {currencySymbol}
            </span>
          )}
        </div>

        {/* Đọc số tiền bằng chữ (Vietnamese text preview) */}
        {wordsPreview && (
          <p className="text-xs text-primary/85 font-medium italic animate-fade-in pl-0.5">
            💬 {wordsPreview}
          </p>
        )}

        {/* Nút bấm gợi ý tiền thông minh (+10k, +50k, +100k, +500k, +1tr, +5tr) */}
        {showQuickButtons && !disabled && !readOnly && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 select-none">
            <span className="text-[11px] text-muted-foreground mr-0.5 font-medium">Nhanh:</span>
            {[
              { label: "+10k", amount: 10_000 },
              { label: "+50k", amount: 50_000 },
              { label: "+100k", amount: 100_000 },
              { label: "+500k", amount: 500_000 },
              { label: "+1tr", amount: 1_000_000 },
              { label: "+5tr", amount: 5_000_000 },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => handleQuickAdd(btn.amount)}
                className="px-2 py-0.5 text-xs font-semibold rounded-md border border-border bg-secondary/50 text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all cursor-pointer active:scale-95"
              >
                {btn.label}
              </button>
            ))}
            {rawValue > 0 && (
              <button
                type="button"
                onClick={handleQuickClear}
                className="px-1.5 py-0.5 text-xs text-rose-500 hover:bg-rose-50 rounded border border-rose-200 transition-colors cursor-pointer"
                title="Xóa về 0"
              >
                ✕ Xóa
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
);

SmartCurrencyInput.displayName = "SmartCurrencyInput";
