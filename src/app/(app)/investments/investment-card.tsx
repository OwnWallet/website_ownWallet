"use client";

import { useState } from "react";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { updateCurrentPrice, addInvestLog, deleteInvestment } from "@/actions/investments";
import { Trash2, PlusCircle, History, Edit3, X } from "lucide-react";
import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";

interface InvestLog {
  id: string;
  action: "BUY" | "SELL";
  quantity: string | number | { toString: () => string };
  price: string | number | { toString: () => string };
  recordedAt: any;
}

interface Investment {
  id: string;
  name: string;
  ticker: string | null;
  assetType?: string | null;
  exchange?: string | null;
  targetPrice?: string | number | { toString: () => string } | null;
  note?: string | null;
  quantity: string | number | { toString: () => string };
  buyPrice: string | number | { toString: () => string };
  currentPrice: string | number | { toString: () => string } | null;
  boughtAt: any;
  updatedAt: any;
  logs: InvestLog[];
}

function getAssetTypeBadge(type?: string | null) {
  switch (type) {
    case "STOCK":
      return { label: "📈 Cổ phiếu", bg: "bg-blue-50 text-blue-700 border-blue-200" };
    case "CRYPTO":
      return { label: "🪙 Crypto", bg: "bg-amber-50 text-amber-700 border-amber-200" };
    case "GOLD":
      return { label: "🥇 Vàng", bg: "bg-yellow-50 text-yellow-800 border-yellow-300" };
    case "FUND":
      return { label: "📊 Quỹ / ETF", bg: "bg-purple-50 text-purple-700 border-purple-200" };
    case "REAL_ESTATE":
      return { label: "🏢 BĐS", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "BOND":
      return { label: "📜 Trái phiếu", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    case "SAVINGS":
      return { label: "🏦 Tiền gửi", bg: "bg-teal-50 text-teal-700 border-teal-200" };
    default:
      return type ? { label: type, bg: "bg-slate-50 text-slate-700 border-slate-200" } : null;
  }
}

export function InvestmentCard({
  inv,
  selected,
  onToggleSelect,
}: {
  inv: Investment;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"view" | "price" | "trade" | "logs">("view");
  const [loading, setLoading] = useState(false);

  const quantity = Number(inv.quantity);
  const buyPrice = Number(inv.buyPrice);
  const currentPrice = Number(inv.currentPrice) || buyPrice;
  const targetPrice = inv.targetPrice ? Number(inv.targetPrice) : null;
  const invested = buyPrice * quantity;
  const current = currentPrice * quantity;
  const pnl = current - invested;
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
  const isPos = pnl >= 0;

  const assetBadge = getAssetTypeBadge(inv.assetType);

  return (
    <div className={`card space-y-4 flex flex-col justify-between group transition-colors ${selected ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}>
      <div>
        {/* Card Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-2.5">
            {onToggleSelect && (
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary/30 cursor-pointer accent-primary mt-1 shrink-0"
                checked={!!selected}
                onChange={onToggleSelect}
                title="Chọn khoản đầu tư này"
              />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {assetBadge && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${assetBadge.bg}`}>
                    {assetBadge.label}
                  </span>
                )}
                {inv.exchange && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    🏛️ {inv.exchange}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-foreground">{inv.name}</h3>
                {inv.ticker && (
                  <span className="text-xs px-2 py-0.5 bg-elevated rounded-md text-muted-foreground border border-border font-bold">
                    {inv.ticker}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-sm font-extrabold ${isPos ? "text-income" : "text-expense"}`}>
                  {pnl > 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <form
              action={async () => {
                await deleteInvestment(inv.id);
              }}
            >
              <button
                type="submit"
                title="Xóa tài sản"
                className="p-1.5 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* Quantities & Prices */}
        <div className="grid grid-cols-2 gap-3 text-xs mt-3 p-3 bg-elevated/60 rounded-xl border border-border">
          <div>
            <p className="text-muted-foreground">Đang nắm giữ</p>
            <p className="font-bold text-sm text-foreground">{quantity.toLocaleString("vi-VN")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Giá mua TB</p>
            <p className="font-bold text-sm text-foreground">{formatCurrency(buyPrice)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Giá thị trường</p>
            <p className="font-bold text-sm text-orange-600">{formatCurrency(currentPrice)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tổng giá trị</p>
            <p className="font-extrabold text-sm text-foreground">{formatCurrency(current)}</p>
          </div>
        </div>

        {/* Target price & Note if available */}
        {(targetPrice || inv.note) && (
          <div className="mt-2.5 pt-2 border-t border-dashed border-border space-y-1 text-xs">
            {targetPrice && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>🎯 Giá mục tiêu:</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(targetPrice)}
                  {currentPrice > 0 && (
                    <span className="ml-1 text-[11px] font-normal text-emerald-600">
                      ({(((targetPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% nữa)
                    </span>
                  )}
                </span>
              </div>
            )}
            {inv.note && (
              <p className="text-[11px] text-muted-foreground italic truncate" title={inv.note}>
                📝 {inv.note}
              </p>
            )}
          </div>
        )}

        {/* Action Tabs Toolbar */}
        <div className="flex gap-1.5 mt-3 pt-2 border-t border-border-strong text-xs">
          <button
            onClick={() => setActiveTab(activeTab === "price" ? "view" : "price")}
            className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === "price" ? "bg-primary text-white font-medium" : "bg-elevated text-muted hover:text-foreground"
            }`}
          >
            <Edit3 size={12} />
            <span>Cập nhật giá</span>
          </button>
          <button
            onClick={() => setActiveTab(activeTab === "trade" ? "view" : "trade")}
            className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === "trade" ? "bg-primary text-white font-medium" : "bg-elevated text-muted hover:text-foreground"
            }`}
          >
            <PlusCircle size={12} />
            <span>Mua/Bán</span>
          </button>
          {inv.logs && inv.logs.length > 0 && (
            <button
              onClick={() => setActiveTab(activeTab === "logs" ? "view" : "logs")}
              className={`py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                activeTab === "logs" ? "bg-primary text-white font-medium" : "bg-elevated text-muted hover:text-foreground"
              }`}
              title="Lịch sử giao dịch"
            >
              <History size={12} />
              <span>{inv.logs.length}</span>
            </button>
          )}
        </div>

        {/* Tab content: Price update */}
        {activeTab === "price" && (
          <form
            action={async (fd) => {
              setLoading(true);
              await updateCurrentPrice(inv.id, fd);
              setLoading(false);
              setActiveTab("view");
            }}
            className="mt-3 p-3 bg-elevated rounded-lg border border-border-strong animate-fade-in space-y-2"
          >
            <div className="flex justify-between items-center text-xs font-semibold text-muted">
              <span>Cập nhật giá hiện tại</span>
              <button type="button" onClick={() => setActiveTab("view")} className="text-muted hover:text-foreground cursor-pointer">
                <X size={12} />
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <SmartCurrencyInput
                name="currentPrice"
                defaultValue={currentPrice}
                allowDecimals
                placeholder="Giá thị trường..."
                containerClassName="flex-1"
                className="w-full bg-background border border-border-strong rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary text-foreground"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-primary py-1.5 px-3 text-xs whitespace-nowrap cursor-pointer"
              >
                {loading ? "..." : "Lưu"}
              </button>
            </div>
          </form>
        )}

        {/* Tab content: Trade Buy/Sell */}
        {activeTab === "trade" && (
          <form
            action={async (fd) => {
              setLoading(true);
              await addInvestLog(inv.id, fd);
              setLoading(false);
              setActiveTab("view");
            }}
            className="mt-3 p-3 bg-elevated rounded-lg border border-border-strong animate-fade-in space-y-2.5"
          >
            <div className="flex justify-between items-center text-xs font-semibold text-muted">
              <span>Ghi nhận Mua / Bán</span>
              <button type="button" onClick={() => setActiveTab("view")} className="text-muted hover:text-foreground cursor-pointer">
                <X size={12} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                name="action"
                className="bg-background border border-border-strong rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary text-foreground"
              >
                <option value="BUY">🟢 Mua thêm</option>
                <option value="SELL">🔴 Bán bớt</option>
              </select>
              <input
                type="number"
                name="quantity"
                placeholder="Số lượng..."
                step="any"
                min="0.00000001"
                className="bg-background border border-border-strong rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary text-foreground"
                required
              />
              <SmartCurrencyInput
                name="price"
                defaultValue={currentPrice}
                allowDecimals
                placeholder="Giá khớp..."
                className="bg-background border border-border-strong rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary text-foreground"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-1.5 text-xs flex justify-center cursor-pointer"
            >
              {loading ? "Đang xử lý..." : "Xác nhận giao dịch"}
            </button>
          </form>
        )}

        {/* Tab content: Logs history */}
        {activeTab === "logs" && inv.logs && inv.logs.length > 0 && (
          <div className="mt-3 p-3 bg-elevated rounded-lg border border-border-strong animate-fade-in space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-muted">
              <span>Lịch sử lệnh khớp</span>
              <button type="button" onClick={() => setActiveTab("view")} className="text-muted hover:text-foreground cursor-pointer">
                <X size={12} />
              </button>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {inv.logs.map((log) => (
                <div key={log.id} className="flex justify-between items-center text-xs py-1 border-b border-border/50 last:border-0">
                  <span
                    className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                      log.action === "BUY" ? "bg-income/10 text-income" : "bg-warning/10 text-warning"
                    }`}
                  >
                    {log.action === "BUY" ? "MUA" : "BÁN"}
                  </span>
                  <span className="text-foreground">
                    {Number(log.quantity).toLocaleString("vi-VN")} @ {formatCurrency(Number(log.price))}
                  </span>
                  <span className="text-muted text-[10px]">{formatRelativeTime(log.recordedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted text-center pt-2 border-t border-border">
        Cập nhật {formatRelativeTime(inv.updatedAt)}
      </p>
    </div>
  );
}
