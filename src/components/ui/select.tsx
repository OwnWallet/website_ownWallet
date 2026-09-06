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
  placeholder?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}

function StyledSelect({
  value,
  onChange,
  options,
  className,
  placeholder,
  size = "sm",
  "aria-label": ariaLabel,
}: StyledSelectProps) {
  return (
    <div className={cn("relative inline-flex", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={cn(
          "appearance-none bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-lg font-semibold text-[var(--fg)] outline-none cursor-pointer transition-all",
          "focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-glow)]",
          "hover:border-[var(--border-brand)] hover:shadow-sm",
          "pr-7", // space for chevron
          size === "sm"
            ? "px-2.5 py-1.5 text-xs"
            : "px-3 py-2 text-sm",
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={size === "sm" ? 13 : 15}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] pointer-events-none"
      />
    </div>
  );
}

export { StyledSelect };
export type { SelectOption, StyledSelectProps };
