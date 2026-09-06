import { cn } from "@/lib/utils";
import type { CategoryType } from "@/types";
import { CATEGORY_TYPE_COLORS } from "@/lib/constants";
import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: CategoryType | "success" | "warning" | "danger" | "default";
}

export function Badge({ className, variant = "INCOME", children, ...props }: BadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "INCOME":
      case "success":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      case "EXPENSE":
      case "danger":
        return "bg-rose-50 text-rose-700 border-rose-200/80";
      case "INVEST":
        return "bg-blue-50 text-blue-700 border-blue-200/80";
      case "DEBT":
      case "warning":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      case "SAVINGS":
        return "bg-purple-50 text-purple-700 border-purple-200/80";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const dotColor = (variant && variant in CATEGORY_TYPE_COLORS)
    ? (CATEGORY_TYPE_COLORS as Record<string, string>)[variant]
    : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs",
        getVariantStyles(),
        className
      )}
      {...props}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          backgroundColor: dotColor || "currentColor",
        }}
      />
      {children}
    </span>
  );
}
