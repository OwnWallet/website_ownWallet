"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createInvestment } from "@/actions/investments";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";

const ASSET_TYPES = [
  { value: "STOCK", label: "📈 Cổ phiếu", defaultExchange: "HOSE" },
  { value: "CRYPTO", label: "🪙 Tiền mã hóa (Crypto)", defaultExchange: "Binance" },
  { value: "GOLD", label: "🥇 Vàng / Kim loại quý", defaultExchange: "SJC" },
  { value: "FUND", label: "📊 Chứng chỉ quỹ / ETF", defaultExchange: "Fmarket" },
  { value: "REAL_ESTATE", label: "🏢 Bất động sản", defaultExchange: "Trực tiếp" },
  { value: "BOND", label: "📜 Trái phiếu", defaultExchange: "TCBS" },
  { value: "SAVINGS", label: "🏦 Tiết kiệm / Tiền gửi", defaultExchange: "Ngân hàng" },
  { value: "OTHER", label: "💎 Khác", defaultExchange: "" },
];

const POPULAR_EXCHANGES = [
  "HOSE",
  "HNX",
  "UPCOM",
  "TCBS",
  "SSI",
  "VPS",
  "VNDIRECT",
  "Binance",
  "OKX",
  "Bybit",
  "SJC",
  "DOJI",
  "PNJ",
  "Bảo Tín Minh Châu",
  "Fmarket",
  "Dragon Capital",
  "VinaCapital",
];

export function AddInvestmentForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [assetType, setAssetType] = useState("STOCK");

  const isBusy = loading || isPending;

  if (!isOpen) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="btn-primary py-2.5 px-5 text-sm flex items-center gap-2 cursor-pointer shadow-sm hover:opacity-95"
        >
          <Plus size={16} />
          <span>Thêm tài sản đầu tư mới</span>
        </button>
      </div>
    );
  }

  return (
    <div className="card bg-card border border-border shadow-md rounded-2xl p-5 sm:p-6 animate-fade-in">
      <datalist id="popular-exchanges">
        {POPULAR_EXCHANGES.map((ex) => (
          <option key={ex} value={ex} />
        ))}
      </datalist>

      <div className="flex justify-between items-center mb-5 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
            📈
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Thêm tài sản đầu tư mới</h2>
            <p className="text-xs text-muted-foreground">Theo dõi danh mục đa dạng: cổ phiếu, crypto, vàng, quỹ...</p>
          </div>
        </div>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (isBusy) return;
          setLoading(true);
          try {
            const fd = new FormData(e.currentTarget);
            await createInvestment(fd);
            setIsOpen(false);
          } catch (err) {
            console.error(err);
          } finally {
            setLoading(false);
          }
        }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start"
      >
        {/* Asset Type */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Loại tài sản
          </label>
          <select
            name="assetType"
            value={assetType}
            disabled={isBusy}
            onChange={(e) => setAssetType(e.target.value)}
            className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Tên tài sản <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            disabled={isBusy}
            className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="VD: FPT, Bitcoin, Vàng nhẫn 9999..."
          />
        </div>

        {/* Ticker */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Mã giao dịch (Ticker)
          </label>
          <input
            type="text"
            name="ticker"
            disabled={isBusy}
            className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 uppercase"
            placeholder="VD: FPT, BTC, SJC..."
          />
        </div>

        {/* Exchange / Platform */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Sàn / Nơi mua
          </label>
          <input
            type="text"
            name="exchange"
            list="popular-exchanges"
            disabled={isBusy}
            className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="VD: HOSE, TCBS, Binance, SJC..."
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Số lượng <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            step="any"
            min="0.00000001"
            name="quantity"
            required
            disabled={isBusy}
            className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="VD: 100 hoặc 0.05"
          />
        </div>

        {/* Buy Price */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Giá mua vào (₫ / đv) <span className="text-rose-500">*</span>
          </label>
          <SmartCurrencyInput
            name="buyPrice"
            required
            min={1}
            disabled={isBusy}
            placeholder="VD: 120,000"
            showQuickButtons={false}
          />
        </div>

        {/* Target Price */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Giá mục tiêu / Chốt lời (₫)
          </label>
          <SmartCurrencyInput
            name="targetPrice"
            disabled={isBusy}
            placeholder="VD: 150,000"
            showQuickButtons={false}
          />
        </div>

        {/* Bought At Date */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Ngày mua <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            name="boughtAt"
            required
            disabled={isBusy}
            defaultValue={new Date().toISOString().split("T")[0]}
            className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Note / Strategy */}
        <div className="md:col-span-2 lg:col-span-4">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Ghi chú chiến lược (Tùy chọn)
          </label>
          <input
            type="text"
            name="note"
            disabled={isBusy}
            placeholder="VD: DCA tích sản mỗi tháng, target nắm giữ 3 năm..."
            className="w-full bg-background rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm focus:outline-none border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-3 mt-3 pt-3 border-t border-border">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setIsOpen(false)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isBusy}
            className="btn-primary py-2.5 px-6 text-sm font-bold flex items-center gap-2 cursor-pointer shadow-sm transition-all"
            style={{
              opacity: isBusy ? 0.6 : 1,
              pointerEvents: isBusy ? "none" : "auto",
            }}
          >
            <Plus size={16} />
            <span>{isBusy ? "Đang lưu..." : "Thêm tài sản"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
