"use client";

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from "react";
import type { ParsedTransaction } from "@/schemas/ai-import";
import ImportReview from "./ImportReview";
import { Upload, FileText, Table, FileSpreadsheet, AlertTriangle, Lightbulb, Brain, Square, Clock } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Persistent Background State (Giữ tiến trình khi chuyển tab trong App)
// ─────────────────────────────────────────────────────────────────────────────

type UploadState =
  | { phase: "idle"; cancelledMessage?: string }
  | { phase: "uploading"; filename: string; model: string; progress: number; startedAt: number }
  | { phase: "analyzing"; filename: string; model: string; startedAt: number }
  | {
      phase: "review";
      transactions: ParsedTransaction[];
      totalFound: number;
      skipped: number;
      duplicateCount: number;
      modeUsed?: "local" | "ai-fallback-local" | "ai";
      fallbackReason?: string;
      detectedBank?: string;
      detectedAccountNumber?: string;
    }
  | { phase: "error"; message: string };

export const AI_IMPORT_STORAGE_KEY = "ownwallet_ai_import_review_v1";

let globalUploadState: UploadState = { phase: "idle" };
let globalAbortController: AbortController | null = null;
let globalLastFile: File | null = null;
const stateListeners = new Set<() => void>();

const IDLE_STATE: UploadState = { phase: "idle" };

function subscribe(listener: () => void) {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

function getSnapshot(): UploadState {
  return globalUploadState;
}

function getServerSnapshot(): UploadState {
  return IDLE_STATE;
}

function setGlobalState(next: UploadState) {
  globalUploadState = next;
  if (typeof window !== "undefined") {
    try {
      if (next.phase === "review") {
        sessionStorage.setItem(AI_IMPORT_STORAGE_KEY, JSON.stringify(next));
      } else if (next.phase === "idle" || next.phase === "error") {
        sessionStorage.removeItem(AI_IMPORT_STORAGE_KEY);
      }
    } catch {
      // Ignore sessionStorage quota errors
    }
  }
  stateListeners.forEach((listener) => listener());
}

const ACCEPTED = ".pdf,.xlsx,.xls,.csv";
const MAX_MB = 10;

interface ImportUploadClientProps {
  wallets?: { id: string; name: string; bankName?: string | null; accountNumber?: string | null }[];
  categories?: { id: string; name: string; type: string; color?: string; icon?: string | null }[];
  defaultModel?: string;
}

const FORMAT_CHIPS = [
  { ext: "PDF", icon: <FileText size={16} className="text-rose-500" />, desc: "TPBank / Techcombank", color: "border-rose-200 bg-rose-50/50" },
  { ext: "XLSX", icon: <FileSpreadsheet size={16} className="text-emerald-500" />, desc: "Excel tùy ý", color: "border-emerald-200 bg-emerald-50/50" },
  { ext: "XLS", icon: <Table size={16} className="text-emerald-500" />, desc: "Excel cũ", color: "border-emerald-200 bg-emerald-50/50" },
  { ext: "CSV", icon: <FileText size={16} className="text-blue-500" />, desc: "CSV tùy ý", color: "border-blue-200 bg-blue-50/50" },
];

export default function ImportUploadClient({
  wallets = [],
  categories = [],
  defaultModel = "gemini-3.7-flash",
}: ImportUploadClientProps) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
  const [isDragging, setIsDragging] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Đồng bộ trạng thái từ sessionStorage khi mount nếu đang ở trạng thái idle
  useEffect(() => {
    if (globalUploadState.phase === "idle" && typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(AI_IMPORT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as UploadState;
          if (parsed && parsed.phase === "review" && Array.isArray(parsed.transactions)) {
            setGlobalState(parsed);
          }
        }
      } catch {
        // Ignore parse error
      }
    }
  }, []);

  // Bộ đếm thời gian thực khi đang tải lên hoặc phân tích
  useEffect(() => {
    if (state.phase !== "uploading" && state.phase !== "analyzing") {
      return;
    }
    const timerId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerId);
  }, [state.phase]);

  const elapsedSeconds =
    (state.phase === "uploading" || state.phase === "analyzing") && state.startedAt
      ? Math.max(0, Math.floor((now - state.startedAt) / 1000))
      : 0;

  // ── Dừng phân tích chủ động ──
  const stopAnalysis = useCallback(() => {
    if (globalAbortController) {
      globalAbortController.abort();
      globalAbortController = null;
    }
    const currentFile =
      globalUploadState.phase === "analyzing" || globalUploadState.phase === "uploading"
        ? globalUploadState.filename
        : "";
    setGlobalState({
      phase: "idle",
      cancelledMessage: currentFile
        ? `Đã dừng phân tích file "${currentFile}". Bạn có thể chọn "⚡ Đọc trực tiếp (Không cần AI)" hoặc model khác rồi tải lại file.`
        : "Đã dừng phân tích theo yêu cầu của bạn.",
    });
  }, []);

  // ── Xử lý file ──
  const processFile = useCallback(async (file: File, overrideModel?: string) => {
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!["pdf", "xlsx", "xls", "csv"].includes(ext)) {
      setGlobalState({
        phase: "error",
        message: `Định dạng .${ext} không được hỗ trợ. Vui lòng dùng PDF, XLSX, XLS, hoặc CSV.`,
      });
      return;
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      setGlobalState({
        phase: "error",
        message: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa ${MAX_MB}MB.`,
      });
      return;
    }

    globalLastFile = file;
    const activeModel = overrideModel ?? selectedModel;

    // Hủy request cũ nếu đang chạy
    if (globalAbortController) {
      globalAbortController.abort();
    }
    const controller = new AbortController();
    globalAbortController = controller;

    const startedAt = Date.now();
    setGlobalState({ phase: "uploading", filename: file.name, model: activeModel, progress: 30, startedAt });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", activeModel);

    setGlobalState({ phase: "analyzing", filename: file.name, model: activeModel, startedAt });

    try {
      const res = await fetch("/api/ai/import", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      globalAbortController = null;

      const data = await res.json();

      if (!res.ok || !data.success) {
        setGlobalState({
          phase: "error",
          message: data.error ?? "Lỗi không xác định từ máy chủ.",
        });
        return;
      }

      setGlobalState({
        phase: "review",
        transactions: data.transactions,
        totalFound: data.totalFound,
        skipped: data.skipped,
        duplicateCount: data.duplicateCount ?? 0,
        modeUsed: data.modeUsed,
        fallbackReason: data.fallbackReason,
        detectedBank: data.detectedBank,
        detectedAccountNumber: data.detectedAccountNumber,
      });
    } catch (err: unknown) {
      if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        return;
      }
      globalAbortController = null;
      const msg = err instanceof Error ? err.message : "Không thể kết nối máy chủ.";
      setGlobalState({ phase: "error", message: msg });
    }
  }, [selectedModel]);

  // ── Chuyển tức thì sang chế độ đọc trực tiếp không cần AI khi AI đang chạy lâu ──
  const switchToLocalParser = useCallback(() => {
    setSelectedModel("local-parser");
    if (globalLastFile) {
      processFile(globalLastFile, "local-parser");
    } else {
      stopAnalysis();
    }
  }, [processFile, stopAnalysis]);

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
  const reset = () => {
    if (globalAbortController) {
      globalAbortController.abort();
      globalAbortController = null;
    }
    setGlobalState({ phase: "idle" });
  };

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return mins > 0
      ? `${mins} phút ${String(rem).padStart(2, "0")} giây`
      : `${sec} giây`;
  };

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
        modeUsed={state.modeUsed}
        fallbackReason={state.fallbackReason}
        detectedBank={state.detectedBank}
        detectedAccountNumber={state.detectedAccountNumber}
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
          <h2 className="text-xl font-bold text-foreground mb-2">Import Sao Kê Tài Chính</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Upload sao kê ngân hàng TPBank (PDF) hoặc bảng Excel / CSV.
            <br />
            Hỗ trợ cả <strong>Đọc trực tiếp siêu tốc (&lt; 1s, không cần AI)</strong> và <strong>Phân tích bằng Gemini AI</strong>.
          </p>
        </div>
      </div>

      {/* ── Drop zone ── */}
      {(state.phase === "idle" || state.phase === "error") && (
        <>
          {/* ── Model Selector Bar ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-border-strong/90 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Brain size={17} />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Chế độ / Model trích xuất:</span>
                  <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    {selectedModel === "local-parser"
                      ? "⚡ Offline Parser (Không phụ thuộc AI)"
                      : "⚡ Hybrid + Tự động dự phòng khi AI lỗi"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selectedModel === "local-parser"
                    ? "Bóc tách trực tiếp bảng sao kê PDF TPBank & Excel/CSV trong < 1 giây, không lo lỗi 503/429"
                    : "Dùng AI phân tích thông minh; tự động chuyển sang bộ đọc PDF nội bộ nếu máy chủ AI quá tải"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                id="ai-import-model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-slate-50 border border-slate-300 hover:border-orange-400 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 cursor-pointer transition-colors shadow-2xs"
              >
                <option value="local-parser">⚡ Đọc trực tiếp Sao kê (Không cần AI - Siêu tốc &lt; 1s)</option>
                <option value="gemini-3.7-flash">🤖 gemini-3.7-flash (Mới nhất - Tự động dự phòng)</option>
                <option value="gemini-3.6-flash">🤖 gemini-3.6-flash</option>
                <option value="gemini-2.5-flash">🤖 gemini-2.5-flash (Nhanh &amp; Thông minh)</option>
                <option value="gemini-2.5-pro">🤖 gemini-2.5-pro (Chuyên sâu)</option>
                <option value="gemini-2.0-flash">🤖 gemini-2.0-flash (Tốc độ cao)</option>
                <option value="gemini-1.5-flash">🤖 gemini-1.5-flash (Ổn định, ít nghẽn)</option>
                <option value="gemini-1.5-pro">🤖 gemini-1.5-pro</option>
              </select>
            </div>
          </div>

          {/* Thông báo đã dừng thủ công */}
          {state.phase === "idle" && state.cancelledMessage && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 animate-scale-in text-xs">
              <div className="flex items-center gap-2">
                <Square size={15} className="text-amber-600 shrink-0 fill-amber-600" />
                <span className="font-medium">{state.cancelledMessage}</span>
              </div>
            </div>
          )}

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

      {/* ── Analyzing state (với đồng hồ đếm thời gian, nút Đọc trực tiếp & nút Dừng phân tích) ── */}
      {(state.phase === "uploading" || state.phase === "analyzing") && (
        <div className="card p-8 sm:p-10 text-center animate-scale-in space-y-4">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-orange-500 border-r-amber-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain size={28} className="text-orange-600" />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              {state.phase === "uploading"
                ? "Đang tải lên…"
                : state.model === "local-parser"
                  ? "Đang đọc trực tiếp cấu trúc bảng sao kê…"
                  : "AI đang phân tích…"}
            </h3>
            <p className="text-sm font-medium text-slate-700 mb-1">📄 {state.filename}</p>
            <p className="text-xs text-muted-foreground">
              {state.phase === "analyzing"
                ? state.model === "local-parser"
                  ? "Bộ phân tích PDF nội bộ đang giải mã bảng và đối chiếu giao dịch trùng lặp…"
                  : `Gemini (${state.model}) đang đọc và trích xuất giao dịch. Tiến trình vẫn được giữ ngay cả khi bạn chuyển sang mục khác.`
                : "Đang gửi file đến máy chủ…"}
            </p>
          </div>

          {/* Thanh tiến độ & bộ đếm giây */}
          <div className="max-w-sm mx-auto space-y-2">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 animate-pulse-soft transition-all duration-500"
                style={{ width: state.phase === "analyzing" ? "85%" : "40%" }}
              />
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
              <Clock size={13} className="text-orange-500" />
              <span>Thời gian đã chạy: {formatElapsed(elapsedSeconds)}</span>
            </div>
          </div>

          {/* Gợi ý khi chạy lâu (> 10 giây) */}
          {elapsedSeconds >= 10 && state.model !== "local-parser" && (
            <div className="max-w-md mx-auto p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs leading-relaxed animate-fade-in">
              💡 <strong>Mẹo xử lý tức thì:</strong> Nếu máy chủ AI đang phản hồi chậm, bạn có thể bấm nút <strong>⚡ Chuyển sang đọc trực tiếp (Không cần AI)</strong> bên dưới để bóc tách sao kê TPBank ngay lập tức trong &lt; 1 giây!
            </div>
          )}

          {/* Nhóm nút bấm hành động: Chuyển sang đọc trực tiếp & Dừng phân tích */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            {state.model !== "local-parser" && (
              <button
                id="btn-switch-local-parser"
                type="button"
                onClick={switchToLocalParser}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <span>⚡ Chuyển sang đọc trực tiếp (Không cần AI)</span>
              </button>
            )}
            <button
              id="btn-stop-ai-import"
              type="button"
              onClick={stopAnalysis}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <Square size={13} className="fill-rose-600 text-rose-600" />
              <span>Dừng phân tích</span>
            </button>
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
