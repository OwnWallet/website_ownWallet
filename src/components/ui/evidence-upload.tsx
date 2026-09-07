"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, X, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface EvidenceUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function EvidenceUpload({ value, onChange, disabled }: EvidenceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file hình ảnh (JPG, PNG, WEBP,...)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Dung lượng ảnh tối đa là 10MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Tải ảnh thất bại");
      }

      onChange(data.url);
      toast.success("Đã tải ảnh bằng chứng giao dịch thành công!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi tải ảnh";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        disabled={disabled || isUploading}
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-border/80 bg-card p-3 shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Thumbnail Preview */}
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted/40 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Bằng chứng giao dịch"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ImageIcon size={14} className="text-primary shrink-0" />
                <span className="truncate">Ảnh bằng chứng / hóa đơn</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                Đã đính kèm ảnh bằng chứng
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  <ExternalLink size={11} />
                  <span>Xem ảnh gốc</span>
                </a>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isUploading}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Đổi ảnh khác
                </button>
              </div>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              title="Xóa ảnh này"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/40 bg-card/50"
          } ${disabled || isUploading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center py-2 gap-2 text-primary">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-xs font-semibold">Đang tải ảnh lên...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <UploadCloud size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Tải lên ảnh bằng chứng / hóa đơn chuyển khoản
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Kéo thả hoặc bấm để chọn ảnh (JPG, PNG, WEBP, tối đa 10MB)
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
