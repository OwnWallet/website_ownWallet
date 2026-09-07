"use client";

import { useState, useRef, useCallback } from "react";
import type { ParsedTransaction } from "@/schemas/ai-import";
import ImportReview from "./ImportReview";
import { Upload, FileText, Table, FileSpreadsheet, AlertTriangle, Lightbulb, Brain } from "lucide-react";

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
      duplicateCount: number;
    }
  | { phase: "error"; message: string };

const ACCEPTED = ".pdf,.xlsx,.xls,.csv";
const MAX_MB = 10;

interface ImportUploadClientProps {
  wallets?: { id: string; name: string; bankName?: string | null; accountNumber?: string | null }[];
  categories?: { id: string; name: string; type: string; color?: string; icon?: string | null }[];
}

const FORMAT_CHIPS = [
  { ext: "PDF", icon: <FileText size={16} className="text-rose-500" />, desc: "Sao kê TPBank", color: "border-rose-200 bg-rose-50/50" },
  { ext: "XLSX", icon: <FileSpreadsheet size={16} className="text-emerald-500" />, desc: "Excel tùy ý", color: "border-emerald-200 bg-emerald-50/50" },
  { ext: "XLS", icon: <Table size={16} className="text-emerald-500" />, desc: "Excel cũ", color: "border-emerald-200 bg-emerald-50/50" },
  { ext: "CSV", icon: <FileText size={16} className="text-blue-500" />, desc: "CSV tùy ý", color: "border-blue-200 bg-blue-50/50" },
];

export default function ImportUploadClient({ wallets = [], categories = [] }: ImportUploadClientProps) {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Xử lý file ──
  const processFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!["pdf", "xlsx", "xls", "csv"].includes(ext)) {
      setState({
        phase: "error",
        message: `Định dạng .${ext} không được hỗ trợ. Vui lòng dùng PDF, XLSX, XLS, hoặc CSV.`,
      });
      return;
    }

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
        duplicateCount: data.duplicateCount ?? 0,
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
        duplicateCount={state.duplicateCount}
        wallets={wallets}
        categories={categories}
        onReset={reset}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Upload / Analyzing / Error
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Hero Card ── */}
      <div className="card bg-gradient-to-br from-orange-50/80 via-amber-50/40 to-white border-orange-200/60 p-6 sm:p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,146,60,0.08),transparent_50%)]" />
        <div className="relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-orange-500/20 mx-auto mb-4">
            🤖
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">AI Import Tài Chính</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Upload sao kê ngân hàng TPBank (PDF) hoặc bảng Excel / CSV.
            <br />
            AI sẽ tự động trích xuất và phân loại từng giao dịch cho bạn.
          </p>
        </div>
      </div>

      {/* ── Drop zone ── */}
      {(state.phase === "idle" || state.phase === "error") && (
        <>
          <div
            id="import-dropzone"
            className={`relative group cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 ${
              isDragging
                ? "border-orange-500 bg-orange-50/80 scale-[1.01] shadow-lg"
                : "border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/30"
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all duration-200 ${
              isDragging
                ? "bg-orange-500 text-white shadow-md scale-110"
                : "bg-slate-100 text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-600"
            }`}>
              <Upload size={24} />
            </div>
            <p className="text-base font-semibold text-foreground mb-1">
              Kéo thả file vào đây, hoặc{" "}
              <span className="text-orange-600 underline underline-offset-2 decoration-orange-300">click để chọn</span>
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, XLSX, XLS, CSV — tối đa {MAX_MB}MB
            </p>
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
            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 animate-scale-in">
              <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold mb-0.5">Lỗi xử lý file</p>
                <p className="text-xs text-rose-700">{state.message}</p>
              </div>
            </div>
          )}

          {/* ── Supported formats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FORMAT_CHIPS.map((f) => (
              <div
                key={f.ext}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all hover-lift ${f.color}`}
              >
                <div className="shrink-0">{f.icon}</div>
                <div>
                  <div className="text-sm font-bold text-foreground">.{f.ext.toLowerCase()}</div>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Analyzing state ── */}
      {(state.phase === "uploading" || state.phase === "analyzing") && (
        <div className="card p-8 sm:p-12 text-center animate-scale-in">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-orange-500 border-r-amber-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain size={28} className="text-orange-600" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            {state.phase === "uploading" ? "Đang tải lên…" : "AI đang phân tích…"}
          </h3>
          <p className="text-sm text-muted-foreground mb-1">📄 {state.filename}</p>
          <p className="text-xs text-muted-foreground mb-5">
            {state.phase === "analyzing"
              ? "Gemini đang đọc và trích xuất giao dịch. Vui lòng chờ trong giây lát…"
              : "Đang gửi file đến máy chủ…"}
          </p>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden max-w-sm mx-auto border border-slate-200/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 animate-pulse-soft transition-all duration-500"
              style={{ width: state.phase === "analyzing" ? "85%" : "40%" }}
            />
          </div>
        </div>
      )}

      {/* ── Tips ── */}
      {state.phase === "idle" && (
        <div className="card p-5 bg-amber-50/40 border-amber-200/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Lightbulb size={14} className="text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Mẹo để AI hoạt động tốt nhất</h3>
          </div>
          <ul className="space-y-2">
            {[
              "Sao kê TPBank: Xuất bản PDF gốc từ Internet Banking (không phải scan)",
              "Excel: Đặt tên cột rõ ràng (Ngày, Số tiền, Mô tả, Loại)",
              "CSV: Dùng dấu phẩy hoặc chấm phẩy làm separator",
              `Tối đa ${MAX_MB}MB — Nếu file lớn hơn, hãy chia nhỏ theo tháng`,
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
