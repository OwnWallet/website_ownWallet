"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, X, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface EvidenceUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

/**
 * Nén ảnh trên trình duyệt bằng Canvas:
 * - Giảm kích thước ảnh từ 5-10MB xuống còn ~100-250KB
 * - Tối ưu hoá định dạng sang WebP (hoặc JPEG fallback)
 * - Hoàn toàn an toàn trên Vercel Serverless và không làm nặng database
 */
async function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    // Nếu là file SVG hoặc GIF, giữ nguyên để không làm mất vector hoặc animation
    if (file.type === "image/svg+xml" || file.type === "image/gif") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Thử xuất WebP trước (nhẹ nhất), nếu trình duyệt không hỗ trợ thì xuất JPEG
          let dataUrl = canvas.toDataURL("image/webp", quality);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(dataUrl);
        } catch {
          resolve(reader.result as string);
        }
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Dung lượng ảnh tối đa là 15MB");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Tối ưu nén ảnh trực tiếp trên trình duyệt
      const compressedDataUrl = await compressImage(file);

      // 2. Gán trực tiếp dữ liệu ảnh an toàn
      onChange(compressedDataUrl);
      toast.success("Đã đính kèm ảnh bằng chứng giao dịch thành công!");
    } catch (err: unknown) {
      // Fallback: nếu Canvas không xử lý được, gọi API upload
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
        toast.success("Đã đính kèm ảnh bằng chứng thành công!");
      } catch {
        const msg = err instanceof Error ? err.message : "Lỗi khi xử lý ảnh";
        toast.error(msg);
      }
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

  function handleViewOriginal() {
    if (!value) return;
    const newWin = window.open();
    if (newWin) {
      newWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Xem ảnh bằng chứng giao dịch</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { margin: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              img { max-width: 95vw; max-height: 95vh; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            </style>
          </head>
          <body>
            <img src="${value}" alt="Ảnh bằng chứng" />
          </body>
        </html>
      `);
      newWin.document.close();
    }
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
            <div
              onClick={handleViewOriginal}
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted/40 shrink-0 cursor-pointer group-hover:opacity-90 transition-opacity"
              title="Bấm để xem ảnh phóng to"
            >
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
                <button
                  type="button"
                  onClick={handleViewOriginal}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  <ExternalLink size={11} />
                  <span>Xem ảnh phóng to</span>
                </button>
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
              <span className="text-xs font-semibold">Đang xử lý & tối ưu ảnh...</span>
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
                  Kéo thả hoặc bấm để chọn ảnh (JPG, PNG, WEBP, tự động tối ưu hóa)
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
