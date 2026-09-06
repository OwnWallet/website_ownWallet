"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--bg-card)",
          "--normal-text": "var(--fg)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--income-subtle)",
          "--success-text": "var(--income)",
          "--success-border": "var(--income)",
          "--error-bg": "var(--expense-subtle)",
          "--error-text": "var(--expense)",
          "--error-border": "var(--expense)",
          "--warning-bg": "var(--debt-subtle)",
          "--warning-text": "var(--debt)",
          "--warning-border": "var(--debt)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-[var(--normal-bg)] group-[.toaster]:text-[var(--normal-text)] group-[.toaster]:border-[var(--normal-border)] group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:bg-[var(--success-bg)] group-[.toaster]:text-[var(--success-text)] group-[.toaster]:border-[var(--success-border)]",
          error: "group-[.toaster]:bg-[var(--error-bg)] group-[.toaster]:text-[var(--error-text)] group-[.toaster]:border-[var(--error-border)]",
          warning: "group-[.toaster]:bg-[var(--warning-bg)] group-[.toaster]:text-[var(--warning-text)] group-[.toaster]:border-[var(--warning-border)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
