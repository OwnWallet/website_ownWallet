"use client";

import { useState, useRef, useCallback } from "react";
import type { ParsedTransaction } from "@/schemas/ai-import";
import ImportReview from "./ImportReview";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; filename: string; progress: number }
  | { phase: "analyzing"; filename: string }
  | {
      phase: "review";
      transactions: ParsedTransaction[];
      totalFound: number;
      skipped: number;
    }
  | { phase: "error"; message: string };

const ACCEPTED = ".pdf,.xlsx,.xls,.csv";
const MAX_MB = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Upload Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportUploadClient() {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Xử lý file ──
  const processFile = useCallback(async (file: File) => {
    // Validate loại file
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!["pdf", "xlsx", "xls", "csv"].includes(ext)) {
      setState({
        phase: "error",
        message: `Định dạng .${ext} không được hỗ trợ. Vui lòng dùng PDF, XLSX, XLS, hoặc CSV.`,
      });
      return;
    }

    // Validate kích thước
    if (file.size > MAX_MB * 1024 * 1024) {
      setState({
        phase: "error",
        message: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa ${MAX_MB}MB.`,
      });
      return;
    }

    setState({ phase: "uploading", filename: file.name, progress: 30 });

    const formData = new FormData();
    formData.append("file", file);

    // Simulate progress (XHR real progress không cần thiết với file nhỏ)
    const progressInterval = setInterval(() => {
      setState((prev) => {
        if (prev.phase !== "uploading") {
          clearInterval(progressInterval);
          return prev;
        }
        return { ...prev, progress: Math.min(prev.progress + 10, 80) };
      });
    }, 400);

    setState({ phase: "analyzing", filename: file.name });

    try {
      const res = await fetch("/api/ai/import", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      const data = await res.json();

      if (!res.ok || !data.success) {
        setState({
          phase: "error",
          message: data.error ?? "Lỗi không xác định từ máy chủ.",
        });
        return;
      }

      setState({
        phase: "review",
        transactions: data.transactions,
        totalFound: data.totalFound,
        skipped: data.skipped,
      });
    } catch (err: unknown) {
      clearInterval(progressInterval);
      const msg = err instanceof Error ? err.message : "Không thể kết nối máy chủ.";
      setState({ phase: "error", message: msg });
    }
  }, []);

  // ── Drag & Drop ──
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  // ── File input change ──
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset để có thể upload lại cùng file
    e.target.value = "";
  };

  // ── Reset về idle ──
  const reset = () => setState({ phase: "idle" });

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Review phase
  // ─────────────────────────────────────────────────────────────────────────
  if (state.phase === "review") {
    return (
      <ImportReview
        transactions={state.transactions}
        totalFound={state.totalFound}
        skipped={state.skipped}
        onReset={reset}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Upload / Analyzing / Error
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="import-upload-wrapper">
      {/* ── Hero section ── */}
      <div className="import-hero">
        <div className="import-hero-icon">🤖</div>
        <h2 className="import-hero-title">AI Import Tài Chính</h2>
        <p className="import-hero-desc">
          Upload sao kê ngân hàng TPBank (PDF) hoặc bảng Excel / CSV.
          <br />
          AI sẽ tự động trích xuất và phân loại từng giao dịch cho bạn.
        </p>
      </div>

      {/* ── Drop zone ── */}
      {(state.phase === "idle" || state.phase === "error") && (
        <>
          <div
            id="import-dropzone"
            className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="dropzone-icon">📁</div>
            <p className="dropzone-primary">
              Kéo thả file vào đây, hoặc <span className="dropzone-link">click để chọn</span>
            </p>
            <p className="dropzone-secondary">PDF, XLSX, XLS, CSV — tối đa {MAX_MB}MB</p>
            <input
              ref={fileInputRef}
              id="import-file-input"
              type="file"
              accept={ACCEPTED}
              onChange={onFileChange}
              className="hidden"
            />
          </div>

          {/* Error message */}
          {state.phase === "error" && (
            <div className="error-banner">
              ⚠️ {state.message}
            </div>
          )}

          {/* ── Supported formats ── */}
          <div className="format-chips">
            {[
              { ext: "PDF", icon: "🔴", desc: "Sao kê TPBank" },
              { ext: "XLSX", icon: "🟢", desc: "Excel tùy ý" },
              { ext: "XLS", icon: "🟢", desc: "Excel cũ" },
              { ext: "CSV", icon: "🔵", desc: "CSV tùy ý" },
            ].map((f) => (
              <div key={f.ext} className="format-chip">
                <span>{f.icon}</span>
                <div>
                  <div className="format-ext">.{f.ext.toLowerCase()}</div>
                  <div className="format-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Analyzing state ── */}
      {(state.phase === "uploading" || state.phase === "analyzing") && (
        <div className="analyzing-card">
          <div className="ai-spinner">
            <div className="spinner-ring" />
            <div className="spinner-brain">🧠</div>
          </div>
          <h3 className="analyzing-title">
            {state.phase === "uploading" ? "Đang tải lên…" : "AI đang phân tích…"}
          </h3>
          <p className="analyzing-filename">📄 {state.filename}</p>
          <p className="analyzing-hint text-subtle text-sm">
            {state.phase === "analyzing"
              ? "Gemini đang đọc và trích xuất giao dịch. Vui lòng chờ trong giây lát…"
              : "Đang gửi file đến máy chủ…"}
          </p>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill animate-pulse-soft"
              style={{ width: state.phase === "analyzing" ? "85%" : "40%" }}
            />
          </div>
        </div>
      )}

      {/* ── Tips ── */}
      {state.phase === "idle" && (
        <div className="import-tips">
          <h3 className="tips-title">💡 Mẹo để AI hoạt động tốt nhất</h3>
          <ul className="tips-list">
            <li>Sao kê TPBank: Xuất bản PDF gốc từ Internet Banking (không phải scan)</li>
            <li>Excel: Đặt tên cột rõ ràng (Ngày, Số tiền, Mô tả, Loại)</li>
            <li>CSV: Dùng dấu phẩy hoặc chấm phẩy làm separator</li>
            <li>Tối đa {MAX_MB}MB — Nếu file lớn hơn, hãy chia nhỏ theo tháng</li>
          </ul>
        </div>
      )}
    </div>
  );
}
