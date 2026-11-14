"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StyledSelect — A styled replacement for native <select> elements.
 * Uses a native <select> underneath for full accessibility and mobile compatibility,
 * but wraps it with custom styling to match the design system.
 */

interface SelectOption {
  value: string;
  label: string;
}

interface StyledSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  selectClassName?: string;
  placeholder?: string;
  size?: "sm" | "md";
  variant?: "default" | "dark";
  "aria-label"?: string;
}

function StyledSelect({
  value,
  onChange,
  options,
  className,
  selectClassName,
  placeholder,
  size = "sm",
  variant = "default",
  "aria-label": ariaLabel,
}: StyledSelectProps) {
  const isPlaceholderActive = !value && Boolean(placeholder);

  return (
    <div className={cn("relative inline-flex", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={cn(
          "w-full appearance-none rounded-lg outline-none cursor-pointer transition-all pr-7",
          variant === "dark"
            ? "bg-white/10 border border-white/20 text-slate-100 hover:bg-white/15 hover:border-white/30 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
            : "bg-white border border-slate-300 text-slate-900 hover:border-slate-400 hover:shadow-xs focus:border-orange-600 focus:ring-2 focus:ring-orange-500/15",
          isPlaceholderActive ? "text-slate-500 font-normal" : "font-semibold",
          size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
          selectClassName
        )}
      >
        {placeholder && (
          <option value="" disabled className="bg-white text-slate-500 font-normal">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-slate-900 font-medium">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={size === "sm" ? 13 : 15}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-colors",
          variant === "dark" ? "text-slate-400" : "text-slate-500"
        )}
      />
    </div>
  );
}

export { StyledSelect };
export type { SelectOption, StyledSelectProps };
