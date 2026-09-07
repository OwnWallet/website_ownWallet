"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  id?: string;
  name?: string;
  value?: number | string;
  defaultValue?: number | string;
  onChange?: (val: number) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  showQuickButtons?: boolean;
  currencySymbol?: string;
}

function formatWithSeparators(num: number | string): string {
  if (num === "" || num === undefined || num === null) return "";
  const n = typeof num === "number" ? num : Number(String(num).replace(/\D/g, ""));
  if (isNaN(n)) return "";
  return new Intl.NumberFormat("vi-VN").format(n);
}

function parseToNumber(str: string): number {
  const clean = String(str).replace(/\D/g, "");
  return clean ? Number(clean) : 0;
}

export function CurrencyInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "0",
  required = false,
  disabled = false,
  className,
  min,
  max,
  showQuickButtons = true,
  currencySymbol = "₫",
}: CurrencyInputProps) {
  const autoId = useId();
  const inputId = id || `curr-input-${autoId}`;

  // Initial numeric value
  const initialNum = value !== undefined ? parseToNumber(String(value)) : (defaultValue !== undefined ? parseToNumber(String(defaultValue)) : 0);
  const [numericValue, setNumericValue] = useState<number>(initialNum);
  const [displayValue, setDisplayValue] = useState<string>(initialNum > 0 ? formatWithSeparators(initialNum) : "");

  // Sync if controlled value changes
  useEffect(() => {
    if (value !== undefined) {
      const num = parseToNumber(String(value));
      setNumericValue(num);
      setDisplayValue(num > 0 ? formatWithSeparators(num) : "");
    }
  }, [value]);

  const updateValue = useCallback(
    (newNum: number) => {
      let finalNum = newNum;
      if (min !== undefined && finalNum < min) finalNum = min;
      if (max !== undefined && finalNum > max) finalNum = max;

      setNumericValue(finalNum);
      setDisplayValue(finalNum > 0 ? formatWithSeparators(finalNum) : "");
      onChange?.(finalNum);
    },
    [min, max, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = parseToNumber(raw);
    setNumericValue(num);
    setDisplayValue(num > 0 ? formatWithSeparators(num) : "");
    onChange?.(num);
  };

  const addAmount = (delta: number) => {
    if (disabled) return;
    updateValue(numericValue + delta);
  };

  const quickAmounts = [
    { label: "+100k", value: 100_000 },
    { label: "+500k", value: 500_000 },
    { label: "+1tr", value: 1_000_000 },
    { label: "+5tr", value: 5_000_000 },
    { label: "+10tr", value: 10_000_000 },
  ];

  return (
    <div className="w-full space-y-1.5">
      <div className="relative flex items-center">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required && numericValue === 0}
          className={cn(
            "w-full bg-background rounded-xl px-3.5 py-2.5 pr-10 text-foreground font-semibold text-sm outline-none transition-all",
            "border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20",
            disabled && "opacity-60 bg-slate-50 cursor-not-allowed",
            className
          )}
        />
        <span className="absolute right-3 text-muted-foreground text-xs font-bold pointer-events-none select-none">
          {currencySymbol}
        </span>
        {name && (
          <input
            type="hidden"
            name={name}
            value={numericValue > 0 ? numericValue : ""}
          />
        )}
      </div>

      {showQuickButtons && !disabled && (
        <div className="flex flex-wrap items-center gap-1">
          {quickAmounts.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => addAmount(q.value)}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-700 transition-colors border border-slate-200/60 cursor-pointer"
            >
              {q.label}
            </button>
          ))}
          {numericValue > 0 && (
            <button
              type="button"
              onClick={() => updateValue(0)}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium text-rose-600 hover:bg-rose-50 transition-colors border border-rose-200 cursor-pointer"
            >
              Xóa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
